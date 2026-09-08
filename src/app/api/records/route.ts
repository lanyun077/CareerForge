import { fail, ok } from '@/lib/api';
import { getStore } from '@/lib/store/memoryStore';

/** 训练记录列表（隐私：用户可查看并删除自己的记录，方案 十） */
export async function GET() {
  return ok(getStore().listSessions());
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('缺少 id 参数', 422);
  const deleted = getStore().deleteRecord(id);
  if (!deleted) return fail('记录不存在', 404);
  return ok({ deleted: true, id });
}
