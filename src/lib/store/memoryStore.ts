import type {
  InterviewSession,
  ResumeAnalysis,
  ReviewReport,
  SessionSummary,
  Store,
  JobPosting,
  RecommendationRecord,
  RoleSnapshot,
} from '@/lib/types';
import { PostgresStore } from './postgresStore';

/**
 * 存储后端选择（方案 5.2「训练记录服务」）：
 *
 * - 未配置 DATABASE_URL：内存存储（进程重启即清空，适合本地开发）
 * - 配置 DATABASE_URL：PostgreSQL / Supabase 持久化（表结构见 db/schema.sql），
 *   连接失败时自动降级为内存存储并在日志中告警，保证演示不中断（方案 六）
 */

class MemoryStore implements Store {
  kind = 'memory' as const;

  private resumeAnalyses = new Map<string, ResumeAnalysis>();
  private sessions = new Map<string, InterviewSession>();
  private reportsBySession = new Map<string, ReviewReport>();
  private jobPostings = new Map<string, JobPosting>();
  private recommendations = new Map<string, RecommendationRecord>();
  private roleSnapshots = new Map<string, RoleSnapshot>();

  async saveResumeAnalysis(a: ResumeAnalysis): Promise<void> {
    this.resumeAnalyses.set(a.id, a);
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    return this.resumeAnalyses.get(id) ?? null;
  }

  async saveSession(s: InterviewSession): Promise<void> {
    this.sessions.set(s.id, s);
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async saveReport(r: ReviewReport): Promise<void> {
    this.reportsBySession.set(r.sessionId, r);
  }

  async getReportBySession(sessionId: string): Promise<ReviewReport | null> {
    return this.reportsBySession.get(sessionId) ?? null;
  }

  async listSessions(): Promise<SessionSummary[]> {
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

  async deleteRecord(sessionId: string): Promise<boolean> {
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

  async saveJobPosting(job: JobPosting): Promise<void> {
    this.jobPostings.set(job.id, job);
  }

  async getJobPosting(id: string): Promise<JobPosting | null> {
    return this.jobPostings.get(id) ?? null;
  }

  async listJobPostings(): Promise<JobPosting[]> {
    return [...this.jobPostings.values()].sort((a, b) => (a.fetchedAt < b.fetchedAt ? 1 : -1));
  }

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    this.recommendations.set(record.id, record);
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    this.roleSnapshots.set(snapshot.id, snapshot);
  }
}

/** 外观：优先 PostgreSQL，任何一次数据库异常后降级内存并保持降级状态 */
class StoreFacade implements Store {
  kind: 'memory' | 'postgres';
  private readonly primary: Store | null;
  private readonly memory = new MemoryStore();
  private degraded = false;

  constructor() {
    const url = process.env.DATABASE_URL?.trim();
    this.primary = url ? new PostgresStore(url) : null;
    this.kind = this.primary ? 'postgres' : 'memory';
  }

  private async run<T>(pgOp: () => Promise<T>, memOp: () => Promise<T>): Promise<T> {
    if (this.primary && !this.degraded) {
      try {
        return await pgOp();
      } catch (err) {
        this.degraded = true;
        this.kind = 'memory';
        console.error(
          '[store] PostgreSQL 不可用，本进程已降级为内存存储（重启后数据将丢失）：',
          err instanceof Error ? err.message : err,
        );
      }
    }
    return memOp();
  }

  async saveResumeAnalysis(a: ResumeAnalysis): Promise<void> {
    return this.run(() => this.primary!.saveResumeAnalysis(a), () => this.memory.saveResumeAnalysis(a));
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    return this.run(() => this.primary!.getResumeAnalysis(id), () => this.memory.getResumeAnalysis(id));
  }

  async saveSession(s: InterviewSession): Promise<void> {
    return this.run(() => this.primary!.saveSession(s), () => this.memory.saveSession(s));
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    return this.run(() => this.primary!.getSession(id), () => this.memory.getSession(id));
  }

  async saveReport(r: ReviewReport): Promise<void> {
    return this.run(() => this.primary!.saveReport(r), () => this.memory.saveReport(r));
  }

  async getReportBySession(sessionId: string): Promise<ReviewReport | null> {
    return this.run(
      () => this.primary!.getReportBySession(sessionId),
      () => this.memory.getReportBySession(sessionId),
    );
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.run(() => this.primary!.listSessions(), () => this.memory.listSessions());
  }

  async deleteRecord(sessionId: string): Promise<boolean> {
    return this.run(() => this.primary!.deleteRecord(sessionId), () => this.memory.deleteRecord(sessionId));
  }

  async saveJobPosting(job: JobPosting): Promise<void> {
    return this.run(() => this.primary!.saveJobPosting(job), () => this.memory.saveJobPosting(job));
  }

  async getJobPosting(id: string): Promise<JobPosting | null> {
    return this.run(() => this.primary!.getJobPosting(id), () => this.memory.getJobPosting(id));
  }

  async listJobPostings(): Promise<JobPosting[]> {
    return this.run(() => this.primary!.listJobPostings(), () => this.memory.listJobPostings());
  }

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    return this.run(() => this.primary!.saveRecommendation(record), () => this.memory.saveRecommendation(record));
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    return this.run(() => this.primary!.saveRoleSnapshot(snapshot), () => this.memory.saveRoleSnapshot(snapshot));
  }
}

/** 全局单例：避免 Next.js dev 模式热重载导致状态丢失 */
const g = globalThis as unknown as { __careerForgeStore?: Store };

export function getStore(): Store {
  if (!g.__careerForgeStore) g.__careerForgeStore = new StoreFacade();
  return g.__careerForgeStore;
}
