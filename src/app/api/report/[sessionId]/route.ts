import { fail, ok, ServiceError } from '@/lib/api';
import { buildReport } from '@/lib/services/reportService';

/** 生成复盘报告（幂等：已生成则直接返回缓存） */
export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const report = await buildReport(params.sessionId);
    return ok(report);
  } catch (err) {
    if (err instanceof ServiceError) return fail(err.message, err.status);
    console.error('[report] failed:', err);
    return fail('复盘报告生成失败，请稍后重试', 500);
  }
}
