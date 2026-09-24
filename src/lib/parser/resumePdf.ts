import { ServiceError } from '@/lib/api';
import { extractTextFromPdf } from './pdf';
import { extractTextFromScannedPdf } from './ocr';

export async function parseResumePdf(file: File) {
  if (file.size > 15 * 1024 * 1024) throw new ServiceError('PDF 文件过大（最大 15 MB）', 413);
  if (!file.size) throw new ServiceError('PDF 文件为空', 422);
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new ServiceError('仅支持 PDF 文件', 415);
  const buffer = await file.arrayBuffer();
  let source: 'text' | 'ocr' = 'text';
  let parsed: { text: string };
  try {
    parsed = await extractTextFromPdf(buffer, AbortSignal.timeout(30_000));
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('未提取到文本')) throw new ServiceError('PDF 解析失败或超时，请检查文件或粘贴简历文本', 422);
    try { parsed = await extractTextFromScannedPdf(buffer, AbortSignal.timeout(60_000)); source = 'ocr'; }
    catch { throw new ServiceError('扫描 PDF OCR 失败或超时，请检查视觉模型配置或粘贴文本', 422); }
  }
  if (parsed.text.length < 10) throw new ServiceError('PDF 中未提取到有效文本，请粘贴简历文本', 422);
  return { text: parsed.text.slice(0, 20_000), fileName: file.name, source };
}
