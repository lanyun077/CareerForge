import { withUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';
import { submitAnswer } from '@/lib/services/interviewService';

/** 提交当前问题的回答；返回更新后的会话与事件类型（追问 / 下一题 / 完成） */
async function handlePOST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string; questionId?: string; answer?: string };
    if (typeof body.sessionId !== 'string' || !body.sessionId) return fail('缺少 sessionId', 422);
    if (typeof body.questionId !== 'string' || !body.questionId) return fail('缺少当前问题标识，请刷新页面后重试', 422);
    if (typeof body.answer !== 'string') return fail('回答内容必须为文本', 422);
    const result = await submitAnswer(body.sessionId, body.answer, body.questionId);
    return ok(result);
  } catch (err) {
    if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[interview/answer] failed:', err);
    return fail('提交回答失败，请重试', 500);
  }
}

export const POST = withUser(handlePOST);
