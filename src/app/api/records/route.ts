import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { getStore } from '@/lib/store/memoryStore';

/** 训练记录列表（隐私：用户可查看并删除自己的记录，方案 十） */
async function handleGET() {
  try {
    return ok(await getStore().listSessions());
  } catch (err) { if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[records:list] failed:', err);
    return fail('获取训练记录失败', 500);
  }
}

async function handleDELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('缺少 id 参数', 422);
  try {
    const deleted = await getStore().deleteRecord(id);
    if (!deleted) return fail('记录不存在', 404);
    return ok({ deleted: true, id });
  } catch (err) { if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[records:delete] failed:', err);
    return fail('删除记录失败', 500);
  }
}

export const GET = withUser(handleGET);

export const DELETE = withUser(handleDELETE);
