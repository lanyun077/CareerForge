/**
 * PostgreSQL / Supabase 持久化存储（表结构见 db/schema.sql）
 *
 * 设计：
 * - 结构化关键列（id / 状态 / 轮次 / 分数）用于查询；完整对象存 JSONB payload，
 *   避免首版为嵌套结构过度建模。
 * - 查询异常由 StoreFacade 返回可重试错误，不迁移或静默切换数据。
 */

import { Pool } from 'pg';
import { ServiceError } from '@/lib/api';
const pools = new Map<string, Pool>();
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
interface PgSessionRow {
  settings: InterviewSession['settings'] | null;
  id: string;
  role_id: string;
  role_name: string;
  resume_analysis_id: string;
  round: number;
  based_on_session_id: string | null;
  focus_weaknesses: string[] | null;
  role_snapshot: InterviewSession['roleSnapshot'] | null;
  plan: InterviewSession['plan'];
  current_plan_index: number;
  questions: InterviewSession['questions'];
  status: InterviewSession['status'];
  started_at: Date;
  finished_at: Date | null;
}

function rowToSession(row: PgSessionRow): InterviewSession {
  return {
    id: row.id,
    settings: row.settings ?? undefined,
    roleId: row.role_id,
    roleName: row.role_name,
    resumeAnalysisId: row.resume_analysis_id,
    round: row.round,
    basedOnSessionId: row.based_on_session_id ?? undefined,
    focusWeaknesses: row.focus_weaknesses ?? undefined,
    roleSnapshot: row.role_snapshot ?? undefined,
    plan: row.plan,
    currentPlanIndex: row.current_plan_index,
    questions: row.questions,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : undefined,
  };
}

export class PostgresStore implements Store {
  kind = 'postgres' as const;

  private pool: Pool;

  constructor(databaseUrl: string, private readonly owner: string) {
    this.pool = pools.get(databaseUrl) ?? new Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
    });
    pools.set(databaseUrl, this.pool);
  }

  async saveResumeAnalysis(a: ResumeAnalysis, snapshots: RoleSnapshot[] = []): Promise<void> {
    await this.withSnapshots(snapshots, async (client) => { await client.query(
      `insert into resume_analyses (id, role_id, resume_text, matching_score, payload, source, created_at, owner_id)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       on conflict (id) do update
         set matching_score = excluded.matching_score,
             payload = excluded.payload,
             source = excluded.source where resume_analyses.owner_id = $8`,
      [a.id, a.roleId, a.resumeText, a.matchingScore, JSON.stringify(a), a.source, a.createdAt, this.owner],
    ); });
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    const r = await this.pool.query('select payload from resume_analyses where id = $1 and owner_id = $2', [id, this.owner]);
    return (r.rows[0]?.payload as ResumeAnalysis | undefined) ?? null;
  }

  async saveSession(s: InterviewSession, snapshots: RoleSnapshot[] = []): Promise<void> {
    await this.withSnapshots(snapshots, async (client) => { await client.query(
      `insert into interview_sessions
         (id, role_id, role_name, resume_analysis_id, round, based_on_session_id,
         focus_weaknesses, role_snapshot, plan, current_plan_index, questions, status, started_at, finished_at, owner_id, settings)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15, $16::jsonb)
       on conflict (id) do update
         set current_plan_index = excluded.current_plan_index,
             questions = excluded.questions,
             status = excluded.status,
             finished_at = excluded.finished_at,
             focus_weaknesses = excluded.focus_weaknesses,
             role_snapshot = excluded.role_snapshot where interview_sessions.owner_id = $15`,
      [
        s.id,
        s.roleId,
        s.roleName,
        s.resumeAnalysisId,
        s.round,
        s.basedOnSessionId ?? null,
        JSON.stringify(s.focusWeaknesses ?? null),
        JSON.stringify(s.roleSnapshot ?? null),
        JSON.stringify(s.plan),
        s.currentPlanIndex,
        JSON.stringify(s.questions),
        s.status,
        s.startedAt,
        s.finishedAt ?? null,
        this.owner,
        JSON.stringify(s.settings ?? null),
      ],
    ); });
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    const r = await this.pool.query('select * from interview_sessions where id = $1 and owner_id = $2', [id, this.owner]);
    return r.rows[0] ? rowToSession(r.rows[0] as unknown as PgSessionRow) : null;
  }

  async updateSession(s: InterviewSession, previousQuestions: InterviewSession['questions']): Promise<boolean> {
    const result = await this.pool.query(
      `update interview_sessions
       set current_plan_index = $2, questions = $3::jsonb, status = $4, finished_at = $5
       where id = $1 and status = 'active' and questions = $6::jsonb and owner_id = $7`,
      [s.id, s.currentPlanIndex, JSON.stringify(s.questions), s.status, s.finishedAt ?? null, JSON.stringify(previousQuestions), this.owner],
    );
    return result.rowCount === 1;
  }

  async saveReport(rep: ReviewReport): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // 锁住会话直到报告落库，使删除与延迟返回的模型结果按事务顺序生效。
      const sessions = await client.query(
        'select id, based_on_session_id from interview_sessions where owner_id = $1 and id = any($2::uuid[]) order by id for update',
        [this.owner, [rep.sessionId, ...(rep.comparison ? [rep.comparison.baseSessionId] : [])]],
      );
      const session = sessions.rows.find((row) => row.id === rep.sessionId);
      if (!session) throw new ServiceError('训练会话不存在', 404);
      if (rep.comparison && (session.based_on_session_id !== rep.comparison.baseSessionId || !sessions.rows.some((row) => row.id === rep.comparison!.baseSessionId))) {
        rep = { ...rep, comparison: undefined };
      }
      await client.query(
      `insert into review_reports
         (id, session_id, role_id, round, overall_score, dimension_scores, comparison, payload, source, created_at, owner_id)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
       on conflict (session_id) do update
         set overall_score = excluded.overall_score,
             dimension_scores = excluded.dimension_scores,
             comparison = excluded.comparison,
             payload = excluded.payload,
             source = excluded.source where review_reports.owner_id = $11`,
      [
        rep.id,
        rep.sessionId,
        rep.roleId,
        rep.round,
        rep.overallScore,
        JSON.stringify(rep.dimensionScores),
        JSON.stringify(rep.comparison ?? null),
        JSON.stringify(rep),
        rep.source,
        rep.createdAt,
        this.owner,
      ],
      );
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  async getReportBySession(sessionId: string): Promise<ReviewReport | null> {
    const r = await this.pool.query('select payload from review_reports where session_id = $1 and owner_id = $2', [sessionId, this.owner]);
    return (r.rows[0]?.payload as ReviewReport | undefined) ?? null;
  }

  async listSessions(): Promise<SessionSummary[]> {
    const r = await this.pool.query(
      `select s.id, s.role_id, s.role_name, s.round, s.status, s.started_at, s.finished_at,
              jsonb_array_length(s.plan) as question_count,
              rep.payload->>'overallScore' as overall_score
       from interview_sessions s
       left join review_reports rep on rep.session_id = s.id and rep.owner_id = s.owner_id
       where s.owner_id = $1 order by s.started_at desc`,
      [this.owner],
    );
    return r.rows.map(
      (row: { id: string; role_id: string; role_name: string; round: number; status: string; started_at: Date; finished_at: Date | null; question_count: number; overall_score: string | null }) => ({
        id: row.id,
        roleId: row.role_id,
        roleName: row.role_name,
        round: row.round,
        status: row.status as SessionSummary['status'],
        startedAt: new Date(row.started_at).toISOString(),
        finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : undefined,
        questionCount: row.question_count,
        overallScore: row.overall_score !== null ? Number(row.overall_score) : undefined,
      }),
    );
  }

  async deleteRecord(sessionId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const del = await client.query('delete from interview_sessions where id = $1 and owner_id = $2 returning resume_analysis_id', [sessionId, this.owner]);
      if (!del.rowCount) { await client.query('rollback'); return false; }
      await client.query("delete from role_snapshots where owner_id = $2 and context = 'interview_session' and reference_id = $1", [sessionId, this.owner]);
      await client.query("update review_reports set comparison = null, payload = payload - 'comparison' where owner_id = $2 and payload->'comparison'->>'baseSessionId' = $1", [sessionId, this.owner]);
      const removed = await client.query(`delete from resume_analyses a where id = $1 and owner_id = $2
        and not exists (select 1 from interview_sessions s where s.resume_analysis_id = a.id) returning id`, [del.rows[0].resume_analysis_id, this.owner]);
      if (removed.rowCount) await client.query("delete from role_snapshots where owner_id = $2 and context = 'resume_analysis' and reference_id = $1", [String(removed.rows[0].id), this.owner]);
      await client.query('commit');
      return true;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  async saveJobPosting(job: JobPosting): Promise<void> {
    await this.pool.query(
      `insert into job_postings
         (id, title, description, raw_description, source, source_url, company, location,
          salary, experience_level, published_at, fetched_at, expires_at, payload, owner_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
       on conflict (id) do update set
         title = excluded.title,
         description = excluded.description,
         raw_description = excluded.raw_description,
         payload = excluded.payload where job_postings.owner_id = $15`,
      [
        job.id,
        job.name,
        job.description,
        job.rawDescription,
        job.source,
        job.sourceUrl ?? null,
        job.company ?? null,
        job.location ?? null,
        job.salary ?? null,
        job.experienceLevel ?? null,
        job.publishedAt ?? null,
        job.fetchedAt,
        job.expiresAt ?? null,
        JSON.stringify(job),
        this.owner,
      ],
    );
  }

  async getJobPosting(id: string): Promise<JobPosting | null> {
    const r = await this.pool.query('select payload from job_postings where id = $1 and owner_id = $2', [id, this.owner]);
    return (r.rows[0]?.payload as JobPosting | undefined) ?? null;
  }

  async listJobPostings(): Promise<JobPosting[]> {
    const r = await this.pool.query('select payload from job_postings where owner_id = $1 order by fetched_at desc', [this.owner]);
    return r.rows.map((row: { payload: JobPosting }) => row.payload);
  }

  async saveRecommendation(record: RecommendationRecord, snapshots: RoleSnapshot[] = []): Promise<void> {
    await this.withSnapshots(snapshots, async (client) => { await client.query(
      `insert into recommendation_runs (id, resume_text, recommendations, created_at, owner_id)
       values ($1, $2, $3::jsonb, $4, $5)`,
      [record.id, record.resumeText, JSON.stringify(record.recommendations), record.createdAt, this.owner],
    ); });
  }

  async listRecommendations(): Promise<RecommendationRecord[]> {
    const result = await this.pool.query('select id, resume_text, recommendations, created_at from recommendation_runs where owner_id = $1 order by created_at desc', [this.owner]);
    return result.rows.map((row) => ({ id: row.id, resumeText: row.resume_text, recommendations: row.recommendations, createdAt: new Date(row.created_at).toISOString() }));
  }

  async clearRecommendations(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from recommendation_runs where owner_id = $1', [this.owner]);
      await client.query("delete from role_snapshots where owner_id = $1 and context = 'recommendation'", [this.owner]);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    return this.withSnapshots([snapshot], async () => undefined);
  }

  private async withSnapshots(snapshots: RoleSnapshot[], write: (client: Pick<Pool, 'query'>) => Promise<void>): Promise<void> {
    if (!snapshots.length) return write(this.pool);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await write(client);
      for (const snapshot of snapshots) await client.query(
        `insert into role_snapshots (id, reference_id, context, role_id, payload, created_at, owner_id)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [snapshot.id, snapshot.referenceId, snapshot.context, snapshot.roleId, JSON.stringify(snapshot.role), snapshot.createdAt, this.owner],
      );
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
}
