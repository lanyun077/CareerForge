/**
 * PDF 文本提取（方案 3.2 / 6.4）
 *
 * 使用 pdfjs-dist（维护活跃、可解析现代压缩流 PDF，包括 Word/WPS 导出的真实简历）。
 * 失败时抛出异常，由调用方降级为「请直接粘贴简历文本」，不允许文件解析成为流程阻塞点。
 */
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** pdfjs 需要标准字体数据以解析非内置字体的 PDF；指向已安装的包内资源。
 *  注意：必须以 / 结尾，Windows 下 path.join 的反斜杠会导致 "Invalid factory url" */
const STANDARD_FONT_DATA_URL = `${path
  .join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts')
  .replace(/\\/g, '/')}/`;

export async function extractTextFromPdf(
  buffer: ArrayBuffer,
): Promise<{ text: string }> {
  if (buffer.byteLength < 5) throw new Error('PDF 文件为空或损坏');
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((it: { str?: string }) => ('str' in it ? it.str ?? '' : ''))
      .filter(Boolean);
    pages.push(strings.join(' '));
  }
  const text = pages.join('\n').replace(/[  ]+/g, ' ').replace(/\u0000/g, '').trim();
  if (!text) throw new Error('PDF 中未提取到文本（可能是纯扫描件图片）');
  return { text };
}
