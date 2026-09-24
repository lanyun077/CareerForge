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
import { ServiceError } from '@/lib/api';
import { currentOwner } from '@/lib/auth';

/**
 * 存储后端选择（方案 5.2「训练记录服务」）：
 *
 * - 未配置 DATABASE_URL：内存存储（进程重启即清空，适合本地开发）
 * - 配置 DATABASE_URL：PostgreSQL / Supabase 持久化（表结构见 db/schema.sql），
 *   已配置数据库发生故障时返回可重试错误，不切换到空内存。
 */

export class MemoryStore implements Store {
  kind = 'memory' as const;

  private resumeAnalyses = new Map<string, ResumeAnalysis>();
  private sessions = new Map<string, InterviewSession>();
  private reportsBySession = new Map<string, ReviewReport>();
  private jobPostings = new Map<string, JobPosting>();
  private recommendations = new Map<string, RecommendationRecord>();
  private roleSnapshots = new Map<string, RoleSnapshot>();

  async saveResumeAnalysis(a: ResumeAnalysis, snapshots: RoleSnapshot[] = []): Promise<void> {
    this.resumeAnalyses.set(a.id, a);
    for (const snapshot of snapshots) this.roleSnapshots.set(snapshot.id, snapshot);
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    return this.resumeAnalyses.get(id) ?? null;
  }

  async saveSession(s: InterviewSession, snapshots: RoleSnapshot[] = []): Promise<void> {
    this.sessions.set(s.id, structuredClone(s));
    for (const snapshot of snapshots) this.roleSnapshots.set(snapshot.id, snapshot);
  }

  async updateSession(s: InterviewSession, previousQuestions: InterviewSession['questions']): Promise<boolean> {
    const current = this.sessions.get(s.id);
    if (!current || current.status !== 'active' || JSON.stringify(current.questions) !== JSON.stringify(previousQuestions)) return false;
    this.sessions.set(s.id, structuredClone(s));
    return true;
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async saveReport(r: ReviewReport): Promise<void> {
    const session = this.sessions.get(r.sessionId);
    if (!session) throw new ServiceError('训练会话不存在', 404);
    const saved = structuredClone(r);
    if (saved.comparison && (session.basedOnSessionId !== saved.comparison.baseSessionId || !this.sessions.has(saved.comparison.baseSessionId))) saved.comparison = undefined;
    this.reportsBySession.set(r.sessionId, saved);
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
    for (const [id, snapshot] of this.roleSnapshots) {
      if (snapshot.context === 'interview_session' && snapshot.referenceId === sessionId) this.roleSnapshots.delete(id);
    }
    for (const other of this.sessions.values()) {
      if (other.basedOnSessionId === sessionId) other.basedOnSessionId = undefined;
    }
    // 仅当没有其他会话引用该简历分析时一并删除
    const stillUsed = [...this.sessions.values()].some(
      (s) => s.resumeAnalysisId === session.resumeAnalysisId,
    );
    if (!stillUsed) {
      this.resumeAnalyses.delete(session.resumeAnalysisId);
      for (const [id, snapshot] of this.roleSnapshots) {
        if (snapshot.context === 'resume_analysis' && snapshot.referenceId === session.resumeAnalysisId) this.roleSnapshots.delete(id);
      }
    }
    for (const report of this.reportsBySession.values()) {
      if (report.comparison?.baseSessionId === sessionId) report.comparison = undefined;
    }
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

  async saveRecommendation(record: RecommendationRecord, snapshots: RoleSnapshot[] = []): Promise<void> {
    this.recommendations.set(record.id, record);
    for (const snapshot of snapshots) this.roleSnapshots.set(snapshot.id, snapshot);
  }

  async listRecommendations(): Promise<RecommendationRecord[]> {
    return [...this.recommendations.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async clearRecommendations(): Promise<void> {
    this.recommendations.clear();
    for (const [id, snapshot] of this.roleSnapshots) if (snapshot.context === 'recommendation') this.roleSnapshots.delete(id);
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    this.roleSnapshots.set(snapshot.id, snapshot);
  }
}

/** 外观：固定使用配置的存储后端，数据库故障保留重试能力。 */
export class StoreFacade implements Store {
  kind: 'memory' | 'postgres';
  private readonly primary: Store | null;
  private readonly memory = new MemoryStore();

  constructor(owner: string) {
    const url = process.env.DATABASE_URL?.trim();
    this.primary = url ? new PostgresStore(url, owner) : null;
    this.kind = this.primary ? 'postgres' : 'memory';
  }

  private async run<T>(pgOp: () => Promise<T>, memOp: () => Promise<T>): Promise<T> {
    if (this.primary) {
      try {
        return await pgOp();
      } catch (err) {
        if (err instanceof ServiceError) throw err;
        throw new ServiceError('数据服务暂时不可用，请保留输入并重试', 503);
      }
    }
    return memOp();
  }

  async saveResumeAnalysis(a: ResumeAnalysis, snapshots: RoleSnapshot[] = []): Promise<void> {
    return this.run(() => this.primary!.saveResumeAnalysis(a, snapshots), () => this.memory.saveResumeAnalysis(a, snapshots));
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    return this.run(() => this.primary!.getResumeAnalysis(id), () => this.memory.getResumeAnalysis(id));
  }

  async saveSession(s: InterviewSession, snapshots: RoleSnapshot[] = []): Promise<void> {
    return this.run(() => this.primary!.saveSession(s, snapshots), () => this.memory.saveSession(s, snapshots));
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    return this.run(() => this.primary!.getSession(id), () => this.memory.getSession(id));
  }

  async updateSession(s: InterviewSession, previousQuestions: InterviewSession['questions']): Promise<boolean> {
    // 条件更新失败不能切换存储重写，否则可能将未确认的数据库提交当成成功。
    if (this.primary) {
      try {
        return await this.primary.updateSession(s, previousQuestions);
      } catch {
        throw new ServiceError('保存回答暂时失败，请保留输入并重试', 503);
      }
    }
    return this.memory.updateSession(s, previousQuestions);
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

  async saveRecommendation(record: RecommendationRecord, snapshots: RoleSnapshot[] = []): Promise<void> {
    return this.run(() => this.primary!.saveRecommendation(record, snapshots), () => this.memory.saveRecommendation(record, snapshots));
  }

  async listRecommendations(): Promise<RecommendationRecord[]> {
    return this.run(() => this.primary!.listRecommendations(), () => this.memory.listRecommendations());
  }

  async clearRecommendations(): Promise<void> {
    return this.run(() => this.primary!.clearRecommendations(), () => this.memory.clearRecommendations());
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    return this.run(() => this.primary!.saveRoleSnapshot(snapshot), () => this.memory.saveRoleSnapshot(snapshot));
  }
}

/** 全局单例：避免 Next.js dev 模式热重载导致状态丢失 */
const g = globalThis as unknown as { __careerForgeStores?: Map<string, Store> };

export function getStore(): Store {
  const owner = currentOwner();
  const stores = g.__careerForgeStores ??= new Map<string, Store>();
  let store = stores.get(owner);
  if (!store) { store = new StoreFacade(owner); stores.set(owner, store); }
  return store;
}
