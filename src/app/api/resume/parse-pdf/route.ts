import { fail, ok } from '@/lib/api';
import { extractTextFromPdf } from '@/lib/parser/pdf';
import { extractTextFromScannedPdf } from '@/lib/parser/ocr';

export const runtime = 'nodejs';

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 30_000;

/** 仅提取 PDF 文本，供前端回填简历输入框；岗位分析由用户选择岗位后显式触发。 */
export async function POST(req: Request) {
  let ocrAttempted = false;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('缺少 PDF 文件', 422, 'no_file');
    if (file.size > MAX_PDF_BYTES) return fail('PDF 文件过大（最大 15 MB）', 413, 'pdf_too_large');
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return fail('仅支持 PDF 文件', 415, 'invalid_file_type');
    }

    const buffer = await file.arrayBuffer();
    let source: 'text' | 'ocr' = 'text';
    let parsed: { text: string };
    try {
      parsed = await Promise.race([
        extractTextFromPdf(buffer),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF 解析超时')), PARSE_TIMEOUT_MS)),
      ]);
    } catch (textError) {
      if (!(textError instanceof Error) || !textError.message.includes('未提取到文本')) throw textError;
      ocrAttempted = true;
      const ocr = await Promise.race([
        extractTextFromScannedPdf(buffer),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR 解析超时')), PARSE_TIMEOUT_MS * 2)),
      ]);
      parsed = ocr;
      source = 'ocr';
    }
    if (parsed.text.length < 10) return fail('PDF 中未提取到有效文本，请直接粘贴简历文本', 422, 'pdf_no_text');
    return ok({ text: parsed.text.slice(0, 20_000), fileName: file.name, source });
  } catch (err) {
    console.error('[resume/parse-pdf] failed:', err);
    const message = ocrAttempted || (err instanceof Error && err.message.includes('OCR'))
      ? '扫描 PDF OCR 失败：请配置支持图片输入的 OCR_MODEL，或直接粘贴简历文本'
      : err instanceof Error && err.message.includes('超时')
        ? 'PDF 解析超时，请改用较小的文件或直接粘贴简历文本'
        : 'PDF 解析失败：请确认文件未损坏，或直接粘贴简历文本';
    return fail(message, 422, 'pdf_parse_failed');
  }
}
