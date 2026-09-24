import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { getStore } from '@/lib/store/memoryStore';

/** 获取训练会话当前状态 */
async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getStore().getSession((await params).id);
    if (!session) return fail('训练会话不存在', 404);
    return ok(session);
  } catch (err) { if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[interview/session] failed:', err);
    return fail('获取会话失败', 500);
  }
}

export const GET = withUser(handleGET);
