-- =============================================================
-- CareerForge 训练记录表结构（Supabase / PostgreSQL）
--
-- 当前版本使用内存存储（src/lib/store/memoryStore.ts，重启即清空）。
-- 接入持久化时实现 Store 接口并使用本结构：
--   - 结构化核心字段用于查询与对比
--   - 复杂嵌套对象存 JSONB，避免首版过度建模
-- =============================================================

create table if not exists resume_analyses (
  id              uuid primary key,
  role_id         text not null,
  resume_text     text not null,
  -- 岗位匹配分 0-100
  matching_score  numeric not null,
  -- extractedFields / gaps / suggestions 等完整结果
  payload         jsonb not null,
  -- 'llm' = 大模型分析，'rule' = 规则兜底
  source          text not null,
  created_at      timestamptz not null default now()
);

create table if not exists interview_sessions (
  id                  uuid primary key,
  role_id             text not null,
  role_name           text not null default '',
  resume_analysis_id  uuid not null references resume_analyses (id) on delete cascade,
  -- 1 = 首轮训练，2 = 再次挑战
  round               int not null default 1,
  -- 再次挑战所依据的首轮会话
  based_on_session_id uuid references interview_sessions (id) on delete set null,
  focus_weaknesses    jsonb,
  role_snapshot       jsonb,
  plan                jsonb not null,
  current_plan_index  int not null default 0,
  -- AskedQuestion[]：题目、回答、追问、逐题维度评分
  questions           jsonb not null default '[]'::jsonb,
  status              text not null default 'active',
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index if not exists idx_sessions_base on interview_sessions (based_on_session_id);

alter table interview_sessions add column if not exists role_snapshot jsonb;

create table if not exists review_reports (
  id              uuid primary key,
  session_id      uuid not null references interview_sessions (id) on delete cascade,
  role_id         text not null,
  round           int not null,
  -- 模拟表现分（后端固定公式计算，非录取概率）
  overall_score   numeric not null,
  dimension_scores jsonb not null,
  comparison      jsonb,
  payload         jsonb not null,
  source          text not null,
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_reports_session on review_reports (session_id);

-- 用户粘贴的企业 JD。完整 JobPosting 保存在 payload，结构化列用于列表和过期处理。
create table if not exists job_postings (
  id                text primary key,
  title             text not null,
  description       text not null default '',
  raw_description   text not null,
  source            text not null default 'user_jd',
  source_url        text,
  company           text,
  location          text,
  salary            text,
  experience_level  text,
  published_at      timestamptz,
  fetched_at        timestamptz not null default now(),
  expires_at        timestamptz,
  payload           jsonb not null
);

create index if not exists idx_job_postings_fetched on job_postings (fetched_at desc);

-- 一次简历推荐结果，保留当时使用的推荐卡片数据，便于后续复盘和指标统计。
create table if not exists recommendation_runs (
  id                uuid primary key,
  resume_text       text not null,
  recommendations   jsonb not null,
  created_at        timestamptz not null default now()
);

-- 岗位快照：推荐、简历分析和面试会话均可引用，避免岗位配置变化影响历史结果。
create table if not exists role_snapshots (
  id                uuid primary key,
  reference_id      text not null,
  context           text not null,
  role_id           text not null,
  payload           jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_role_snapshots_reference on role_snapshots (reference_id, context);

-- 用户归属迁移：NULL 的历史数据保持隔离，禁止自动分配给首个登录用户。
alter table resume_analyses add column if not exists owner_id text;
alter table interview_sessions add column if not exists owner_id text;
alter table review_reports add column if not exists owner_id text;
alter table job_postings add column if not exists owner_id text;
alter table recommendation_runs add column if not exists owner_id text;
alter table role_snapshots add column if not exists owner_id text;
create index if not exists idx_analyses_owner on resume_analyses (owner_id);
create index if not exists idx_sessions_owner on interview_sessions (owner_id);
create index if not exists idx_reports_owner on review_reports (owner_id);
create index if not exists idx_jobs_owner on job_postings (owner_id);
create index if not exists idx_recommendations_owner on recommendation_runs (owner_id);
create index if not exists idx_snapshots_owner on role_snapshots (owner_id);

-- 仅服务器通过 DATABASE_URL 访问；不向 Supabase anon/authenticated REST 角色开放表。
alter table resume_analyses enable row level security;
alter table interview_sessions enable row level security;
alter table review_reports enable row level security;
alter table job_postings enable row level security;
alter table recommendation_runs enable row level security;
alter table role_snapshots enable row level security;

-- 面试配置随会话保存，历史记录使用标准默认配置。
alter table interview_sessions add column if not exists settings jsonb;
