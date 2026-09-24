import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { importJobPosting, type ParsedJob } from '@/lib/services/roleService';
import { asRecord, asString, asStringArray } from '@/lib/llm/validate';

async function handlePOST(req: Request) {
  try {
    const body = (await req.json()) as { jobText?: string; preview?: boolean; confirmed?: unknown; provenance?: unknown; collectionReceipt?: unknown };
    if (typeof body.jobText !== 'string') return fail('招聘描述格式无效', 422);
    const jobText = body.jobText.trim();
    if (jobText.length > 12_000) return fail('招聘描述不能超过 12000 字', 422);
    if (jobText.length < 30) return fail('招聘描述过短，请粘贴完整 JD', 422, 'job_too_short');
    let confirmed: ParsedJob | undefined;
    if (body.confirmed !== undefined) {
      const draft = asRecord(body.confirmed);
      if (!draft || !asString(draft.title) || !asStringArray(draft.requiredSkills).length) return fail('请填写岗位名称与至少一项必备技能', 422);
      confirmed = { title: asString(draft.title).slice(0, 80), description: asString(draft.description).slice(0, 500), responsibilities: asStringArray(draft.responsibilities, 12).map((s) => s.slice(0, 200)), requiredSkills: asStringArray(draft.requiredSkills, 15).map((s) => s.slice(0, 200)), preferredSkills: asStringArray(draft.preferredSkills, 10).map((s) => s.slice(0, 200)) };
    }
    return ok(await importJobPosting(jobText.slice(0, 12_000), { preview: body.preview === true, confirmed, provenance: body.provenance, collectionReceipt: body.collectionReceipt }));
  } catch (error) { if (error instanceof ServiceError) return fail(error.message, error.status);
    return fail('招聘描述解析失败，请重试', 500);
  }
}

export const POST = withUser(handlePOST);
