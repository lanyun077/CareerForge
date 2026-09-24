import { withUser } from '@/lib/auth';
import { fail, ok } from '@/lib/api';
import { extractTextFromDocx } from '@/lib/parser/docx';
export const runtime = 'nodejs';
export const POST = withUser(async (req: Request) => {
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) return fail('缺少 DOCX 文件', 422);
  return ok(await extractTextFromDocx(file));
});
