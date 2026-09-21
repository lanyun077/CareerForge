/**
 * PostgreSQL / Supabase 持久化存储（表结构见 db/schema.sql）
 *
 * 设计：
 * - 结构化关键列（id / 状态 / 轮次 / 分数）用于查询；完整对象存 JSONB payload，
 *   避免首版为嵌套结构过度建模。
 * - 任何查询异常由 StoreFacade 捕获并降级内存存储（见 memoryStore.ts）。
 */

import { Pool } from 'pg';
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

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
    });
  }

  async saveResumeAnalysis(a: ResumeAnalysis): Promise<void> {
    await this.pool.query(
      `insert into resume_analyses (id, role_id, resume_text, matching_score, payload, source, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)
       on conflict (id) do update
         set matching_score = excluded.matching_score,
             payload = excluded.payload,
             source = excluded.source`,
      [a.id, a.roleId, a.resumeText, a.matchingScore, JSON.stringify(a), a.source, a.createdAt],
    );
  }

  async getResumeAnalysis(id: string): Promise<ResumeAnalysis | null> {
    const r = await this.pool.query('select payload from resume_analyses where id = $1', [id]);
    return (r.rows[0]?.payload as ResumeAnalysis | undefined) ?? null;
  }

  async saveSession(s: InterviewSession): Promise<void> {
    await this.pool.query(
      `insert into interview_sessions
         (id, role_id, role_name, resume_analysis_id, round, based_on_session_id,
         focus_weaknesses, role_snapshot, plan, current_plan_index, questions, status, started_at, finished_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12, $13, $14)
       on conflict (id) do update
         set current_plan_index = excluded.current_plan_index,
             questions = excluded.questions,
             status = excluded.status,
             finished_at = excluded.finished_at,
             focus_weaknesses = excluded.focus_weaknesses,
             role_snapshot = excluded.role_snapshot`,
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
      ],
    );
  }

  async getSession(id: string): Promise<InterviewSession | null> {
    const r = await this.pool.query('select * from interview_sessions where id = $1', [id]);
    return r.rows[0] ? rowToSession(r.rows[0] as unknown as PgSessionRow) : null;
  }

  async saveReport(rep: ReviewReport): Promise<void> {
    await this.pool.query(
      `insert into review_reports
         (id, session_id, role_id, round, overall_score, dimension_scores, comparison, payload, source, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
       on conflict (session_id) do update
         set overall_score = excluded.overall_score,
             dimension_scores = excluded.dimension_scores,
             comparison = excluded.comparison,
             payload = excluded.payload,
             source = excluded.source`,
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
      ],
    );
  }

  async getReportBySession(sessionId: string): Promise<ReviewReport | null> {
    const r = await this.pool.query('select payload from review_reports where session_id = $1', [sessionId]);
    return (r.rows[0]?.payload as ReviewReport | undefined) ?? null;
  }

  async listSessions(): Promise<SessionSummary[]> {
    const r = await this.pool.query(
      `select s.id, s.role_id, s.role_name, s.round, s.status, s.started_at, s.finished_at,
              jsonb_array_length(s.plan) as question_count,
              rep.payload->>'overallScore' as overall_score
       from interview_sessions s
       left join review_reports rep on rep.session_id = s.id
       order by s.started_at desc`,
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
    const exist = await this.pool.query('select 1 from interview_sessions where id = $1', [sessionId]);
    if (!exist.rowCount) return false;
    // 报告经外键级联删除
    const del = await this.pool.query(
      'delete from interview_sessions where id = $1 returning resume_analysis_id',
      [sessionId],
    );
    const analysisId: string | undefined = del.rows[0]?.resume_analysis_id;
    if (analysisId) {
      // 没有其他会话引用时，一并删除简历分析（隐私：彻底删除）
      await this.pool.query(
        `delete from resume_analyses a
         where a.id = $1
           and not exists (select 1 from interview_sessions s where s.resume_analysis_id = a.id)`,
        [analysisId],
      );
    }
    return true;
  }

  async saveJobPosting(job: JobPosting): Promise<void> {
    await this.pool.query(
      `insert into job_postings
         (id, title, description, raw_description, source, source_url, company, location,
          salary, experience_level, published_at, fetched_at, expires_at, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
       on conflict (id) do update set
         title = excluded.title,
         description = excluded.description,
         raw_description = excluded.raw_description,
         payload = excluded.payload`,
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
      ],
    );
  }

  async getJobPosting(id: string): Promise<JobPosting | null> {
    const r = await this.pool.query('select payload from job_postings where id = $1', [id]);
    return (r.rows[0]?.payload as JobPosting | undefined) ?? null;
  }

  async listJobPostings(): Promise<JobPosting[]> {
    const r = await this.pool.query('select payload from job_postings order by fetched_at desc');
    return r.rows.map((row: { payload: JobPosting }) => row.payload);
  }

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    await this.pool.query(
      `insert into recommendation_runs (id, resume_text, recommendations, created_at)
       values ($1, $2, $3::jsonb, $4)`,
      [record.id, record.resumeText, JSON.stringify(record.recommendations), record.createdAt],
    );
  }

  async saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void> {
    await this.pool.query(
      `insert into role_snapshots (id, reference_id, context, role_id, payload, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6)`,
      [snapshot.id, snapshot.referenceId, snapshot.context, snapshot.roleId, JSON.stringify(snapshot.role), snapshot.createdAt],
    );
  }
}
