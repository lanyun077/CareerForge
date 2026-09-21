import { fail, ok } from '@/lib/api';
import { recommendRoles } from '@/lib/services/roleService';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { resumeText?: string };
    const resumeText = (body.resumeText ?? '').trim();
    if (resumeText.length < 50) return fail('简历文本过短（至少 50 字）', 422, 'resume_too_short');
    return ok(await recommendRoles(resumeText.slice(0, 20_000)));
  } catch {
    return fail('岗位推荐失败，请重试', 500);
  }
}
