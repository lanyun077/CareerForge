import mammoth from 'mammoth';
import { ServiceError } from '@/lib/api';
import { inflateRawSync } from 'node:zlib';

/** 提取正文和表格文本，不输出 HTML，不访问外部文件。 */
export async function extractTextFromDocx(file: File) {
  if (!file.name.toLowerCase().endsWith('.docx')) throw new ServiceError('仅支持 DOCX 文件，不支持旧版 DOC', 415);
  if (!file.size || file.size > 5 * 1024 * 1024) throw new ServiceError('DOCX 不能为空且不能超过 5 MB', 413);
  const buffer = Buffer.from(await file.arrayBuffer());
  // 检查 ZIP 中央目录声明的解压体积，限制压缩文档的资源消耗。
  let total = 0;
  let entries = 0;
  let expanded = 0;
  for (let i = 0; i + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    total += buffer.readUInt32LE(i + 24);
    entries++;
    if (total > 20 * 1024 * 1024 || entries > 1000) throw new ServiceError('DOCX 解压内容过大，请精简文档', 413);
    const local = buffer.readUInt32LE(i + 42);
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new ServiceError('DOCX 文件损坏', 422);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const compressed = buffer.readUInt32LE(i + 20);
    if (start + compressed > buffer.length) throw new ServiceError('DOCX 文件损坏', 422);
    const method = buffer.readUInt16LE(i + 10);
    try {
      if (method !== 0 && method !== 8) throw new Error('Unsupported compression');
      const size = method === 0 ? compressed : inflateRawSync(buffer.subarray(start, start + compressed), { maxOutputLength: 20 * 1024 * 1024 - expanded }).length;
      expanded += size;
      if (expanded > 20 * 1024 * 1024 || size !== buffer.readUInt32LE(i + 24)) throw new Error('Invalid expanded size');
    } catch { throw new ServiceError('DOCX 压缩内容无效或过大', 413); }
    i += 45 + buffer.readUInt16LE(i + 28) + buffer.readUInt16LE(i + 30) + buffer.readUInt16LE(i + 32);
  }
  if (!entries) throw new ServiceError('DOCX 文件损坏', 422);
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.replace(/\u0000/g, '').trim();
    if (text.length < 10) throw new Error('No text');
    return { text: text.slice(0, 20_000), fileName: file.name, source: 'text' as const };
  } catch { throw new ServiceError('DOCX 提取失败，请确认文件有效或粘贴文本', 422); }
}
