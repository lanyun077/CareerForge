import { fail, ok } from '@/lib/api';
import { getStore } from '@/lib/store/memoryStore';

/** 获取训练会话当前状态 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getStore().getSession(params.id);
    if (!session) return fail('训练会话不存在', 404);
    return ok(session);
  } catch (err) {
    console.error('[interview/session] failed:', err);
    return fail('获取会话失败', 500);
  }
}
