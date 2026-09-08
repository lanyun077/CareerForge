import type {
  InterviewSession,
  ResumeAnalysis,
  ReviewReport,
  SessionSummary,
} from '@/lib/types';

/**
 * 训练记录存储接口（方案 5.2「训练记录服务」）
 *
 * 当前实现：内存存储（进程重启即清空，适合演示与开发）。
 * 接入 Supabase / PostgreSQL 时实现同接口替换即可，表结构见 db/schema.sql。
 */
export interface Store {
  saveResumeAnalysis(a: ResumeAnalysis): void;
  getResumeAnalysis(id: string): ResumeAnalysis | null;

  saveSession(s: InterviewSession): void;
  getSession(id: string): InterviewSession | null;

  saveReport(r: ReviewReport): void;
  getReportBySession(sessionId: string): ReviewReport | null;

  listSessions(): SessionSummary[];
  /** 级联删除训练记录（隐私：用户可删除自己的训练数据） */
  deleteRecord(sessionId: string): boolean;
}

class MemoryStore implements Store {
  private resumeAnalyses = new Map<string, ResumeAnalysis>();
  private sessions = new Map<string, InterviewSession>();
  private reportsBySession = new Map<string, ReviewReport>();

  saveResumeAnalysis(a: ResumeAnalysis): void {
    this.resumeAnalyses.set(a.id, a);
  }

  getResumeAnalysis(id: string): ResumeAnalysis | null {
    return this.resumeAnalyses.get(id) ?? null;
  }

  saveSession(s: InterviewSession): void {
    this.sessions.set(s.id, s);
  }

  getSession(id: string): InterviewSession | null {
    return this.sessions.get(id) ?? null;
  }

  saveReport(r: ReviewReport): void {
    this.reportsBySession.set(r.sessionId, r);
  }

  getReportBySession(sessionId: string): ReviewReport | null {
    return this.reportsBySession.get(sessionId) ?? null;
  }

  listSessions(): SessionSummary[] {
    const out: SessionSummary[] = [];
    for (const s of this.sessions.values()) {
      const report = this.reportsBySession.get(s.id);
      out.push({
        id: s.id,
        roleId: s.roleId,
        roleName: s.roleName,
        round: s.round,
        status: s.status,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        questionCount: s.plan.length,
        overallScore: report?.overallScore,
      });
    }
    return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }

  deleteRecord(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    this.reportsBySession.delete(sessionId);
    // 仅当没有其他会话引用该简历分析时一并删除
    const stillUsed = [...this.sessions.values()].some(
      (s) => s.resumeAnalysisId === session.resumeAnalysisId,
    );
    if (!stillUsed) this.resumeAnalyses.delete(session.resumeAnalysisId);
    return true;
  }
}

/** 全局单例：避免 Next.js dev 模式热重载导致状态丢失 */
const g = globalThis as unknown as { __careerForgeStore?: Store };

export function getStore(): Store {
  if (!g.__careerForgeStore) g.__careerForgeStore = new MemoryStore();
  return g.__careerForgeStore;
}
