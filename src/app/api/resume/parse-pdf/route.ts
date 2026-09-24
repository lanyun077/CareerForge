import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { parseResumePdf } from '@/lib/parser/resumePdf';
export const runtime = 'nodejs';
export const POST = withUser(async (req: Request) => {
  try {
    const file = (await req.formData()).get('file');
    if (!(file instanceof File)) return fail('缺少 PDF 文件', 422, 'no_file');
    return ok(await parseResumePdf(file));
  } catch (error) {
    return fail(error instanceof ServiceError ? error.message : 'PDF 解析失败，请粘贴文本', error instanceof ServiceError ? error.status : 422, 'pdf_parse_failed');
  }
});