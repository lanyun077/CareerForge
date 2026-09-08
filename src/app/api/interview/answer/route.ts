import { fail, ok, ServiceError } from '@/lib/api';
import { submitAnswer } from '@/lib/services/interviewService';

/** 提交当前问题的回答；返回更新后的会话与事件类型（追问 / 下一题 / 完成） */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string; answer?: string };
    if (!body.sessionId) return fail('缺少 sessionId', 422);
    const result = await submitAnswer(body.sessionId, body.answer ?? '');
    return ok(result);
  } catch (err) {
    if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[interview/answer] failed:', err);
    return fail('提交回答失败，请重试', 500);
  }
}
