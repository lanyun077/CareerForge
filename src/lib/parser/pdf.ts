/**
 * PDF 文本提取（方案 3.2 / 6.4）
 *
 * 失败时抛出异常，由调用方降级为「请直接粘贴简历文本」，
 * 不允许文件解析成为流程阻塞点。
 */
export async function extractTextFromPdf(
  buffer: ArrayBuffer,
): Promise<{ text: string }> {
  const mod = (await import('pdf-parse/lib/pdf-parse.js')) as unknown as {
    default: (buf: Buffer) => Promise<{ text?: string }>;
  };
  const pdfParse = mod.default;
  const data = await pdfParse(Buffer.from(buffer));
  const text = (data?.text ?? '').replace(/\u0000/g, '').trim();
  if (!text) throw new Error('PDF 中未提取到文本（可能是扫描件）');
  return { text };
}
