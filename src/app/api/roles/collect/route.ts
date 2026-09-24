import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { collectJobPosting } from '@/lib/services/jobCollection';

export const runtime = 'nodejs';

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    return ok(await collectJobPosting(body?.url));
  } catch (error) {
    if (error instanceof ServiceError) return fail(error.message, error.status);
    return fail('岗位链接请求格式错误', 400);
  }
}

export const POST = withUser(handlePOST);
