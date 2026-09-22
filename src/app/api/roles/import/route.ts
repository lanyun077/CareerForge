import { fail, ok } from '@/lib/api';
import { importJobPosting } from '@/lib/services/roleService';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { jobText?: string };
    const jobText = (body.jobText ?? '').trim();
    if (jobText.length < 30) return fail('招聘描述过短，请粘贴完整 JD', 422, 'job_too_short');
    return ok(await importJobPosting(jobText.slice(0, 12_000)));
  } catch {
    return fail('招聘描述解析失败，请重试', 500);
  }
}
