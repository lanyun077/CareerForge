import { fail, ok, ServiceError } from '@/lib/api';
import { startSession, type StartSessionParams } from '@/lib/services/interviewService';

/** 开始一次训练（round=2 时为基于首轮报告的再次挑战，简历分析可从首轮继承） */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<StartSessionParams>;
    const round = body.round === 2 ? 2 : 1;
    if (!body.roleId) return fail('缺少 roleId', 422);
    if (round !== 2 && !body.resumeAnalysisId) return fail('缺少 resumeAnalysisId', 422);
    const session = await startSession({
      roleId: body.roleId,
      resumeAnalysisId: body.resumeAnalysisId ?? '',
      round,
      basedOnSessionId: body.basedOnSessionId,
    });
    return ok(session);
  } catch (err) {
    if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[interview/start] failed:', err);
    return fail('开始训练失败，请重试', 500);
  }
}
