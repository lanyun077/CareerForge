import { deflateSync } from 'zlib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getLLMConfig } from '@/lib/llm/client';

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface OcrResult {
  text: string;
  pages: number;
  model: string;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(8 + data.length, crc32(body));
  return out;
}

/** 将 pdfjs 返回的 RGB/RGBA/灰度像素编码为 PNG，避免引入原生 canvas。 */
function imageToPng(image: PdfImage): string {
  const expected = image.width * image.height;
  let channels = image.data.length === expected * 4 ? 4 : image.data.length === expected * 3 ? 3 : 1;
  const colorType = channels === 4 ? 6 : channels === 3 ? 2 : 0;
  const stride = image.width * channels;
  const scanlines = new Uint8Array((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    scanlines[y * (stride + 1)] = 0;
    scanlines.set(image.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, image.width);
  new DataView(header.buffer).setUint32(4, image.height);
  header[8] = 8;
  header[9] = colorType;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = concatBytes(
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', new Uint8Array()),
  );
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

async function imagesFromPage(page: { getOperatorList: () => Promise<{ argsArray: unknown[][] }>; objs: { get: (name: string) => unknown } }): Promise<PdfImage[]> {
  const ops = await page.getOperatorList();
  const images: PdfImage[] = [];
  const seen = new Set<unknown>();
  for (const args of ops.argsArray) {
    for (const value of args) {
      if (typeof value !== 'string' || seen.has(value)) continue;
      seen.add(value);
      try {
        const image = page.objs.get(value) as { data?: Uint8Array; width?: number; height?: number } | null;
        if (image?.data && image.width && image.height && image.width * image.height <= 12_000_000) {
          images.push({ data: new Uint8Array(image.data), width: image.width, height: image.height });
        }
      } catch {
        // 不是图像对象，继续检查其他操作数。
      }
    }
  }
  return images;
}

async function ocrImage(imageUrl: string, model: string, timeoutMs: number): Promise<string> {
  const cfg = getLLMConfig();
  if (!cfg) throw new Error('OCR 未配置大模型 API');
  const apiKey = process.env.OCR_API_KEY?.trim() || cfg.apiKey;
  const res = await fetch(`${(process.env.OCR_BASE_URL || cfg.baseUrl).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: '请逐字识别这张简历页面图片中的所有可读文字。保持原有段落顺序，只返回识别到的文字，不要总结、不要补写。' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ] }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OCR 模型请求失败（HTTP ${res.status}）`);
  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (text.length < 2) throw new Error('OCR 未返回有效文字');
  return text;
}

/** 扫描件 OCR：每页最多取一张最大图像，避免把简历照片等装饰图重复送入模型。 */
export async function extractTextFromScannedPdf(buffer: ArrayBuffer): Promise<OcrResult> {
  const cfg = getLLMConfig();
  if (!cfg) throw new Error('OCR 未配置大模型 API');
  const model = process.env.OCR_MODEL?.trim() || 'qwen-vl-plus';
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(doc.numPages, 8);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const images = await imagesFromPage(page as unknown as Parameters<typeof imagesFromPage>[0]);
    const image = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!image) continue;
    pages.push(await ocrImage(imageToPng(image), model, 25_000));
  }
  const text = pages.join('\n\n').replace(/\u0000/g, '').trim();
  if (text.length < 10) throw new Error('OCR 未识别到足够文字');
  return { text, pages: pages.length, model };
}
