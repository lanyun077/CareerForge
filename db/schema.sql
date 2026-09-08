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
  resume_analysis_id  uuid not null references resume_analyses (id) on delete cascade,
  -- 1 = 首轮训练，2 = 再次挑战
  round               int not null default 1,
  -- 再次挑战所依据的首轮会话
  based_on_session_id uuid references interview_sessions (id) on delete set null,
  focus_weaknesses    jsonb,
  plan                jsonb not null,
  current_plan_index  int not null default 0,
  -- AskedQuestion[]：题目、回答、追问、逐题维度评分
  questions           jsonb not null default '[]'::jsonb,
  status              text not null default 'active',
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index if not exists idx_sessions_base on interview_sessions (based_on_session_id);

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
