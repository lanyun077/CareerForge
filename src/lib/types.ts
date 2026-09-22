/**
 * CareerForge 核心数据结构
 * 对应项目方案 5.3：RoleProfile / JobPosting / ResumeAnalysis / InterviewSession / ReviewReport
 */

// ===== 岗位配置 =====

/** 带关键词的技能描述（用于规则兜底匹配简历） */
export interface KeywordSkill {
  /** 技能名称，如 “Redis 缓存” */
  label: string;
  /** 简历文本中出现任一关键词即视为已具备（小写匹配） */
  keywords: string[];
}

export interface RoleRequirement {
  responsibilities: string[];
  requiredSkills: KeywordSkill[];
  preferredSkills: KeywordSkill[];
  commonProjectTypes: string[];
}

/** 评分维度与规则（最终得分由后端按固定公式计算，见 scoringService） */
export interface ScoringDimension {
  id: string;
  name: string;
  /** 权重（0-1），全部维度权重之和为 1 */
  weight: number;
  /** 评价重点 */
  focus: string;
  /** 单维度满分 */
  maxScore: number;
}

/** 题库问题 */
export interface BankQuestion {
  id: string;
  /** 所属阶段 id */
  stage: string;
  text: string;
  /** 便于“再次挑战”按薄弱维度选题 */
  tags: string[];
}

export interface InterviewStage {
  id: string;
  name: string;
  /** 该阶段提问数量 */
  questionCount: number;
}

/** 稳定的职业方向配置，用于简历初步推荐。 */
export interface RoleProfile {
  kind: 'role_profile';
  id: string;
  name: string;
  /** 职业方向分类，例如 AI/Agent、软件工程、数据、基础设施 */
  category?: string;
  /** 搜索和岗位归一化使用的别名 */
  aliases?: string[];
  description: string;
  /** 是否为模拟岗位 */
  isMock: boolean;
  mockNotice: string;
  requirements: RoleRequirement;
  interviewStages: InterviewStage[];
  scoringRubric: ScoringDimension[];
  questionBank: BankQuestion[];
}

/** 具体企业岗位或用户导入的 JD，用于一次岗位快照和专项训练。 */
export interface JobPosting {
  kind: 'job_posting';
  id: string;
  name: string;
  category?: string;
  aliases?: string[];
  description: string;
  isMock: boolean;
  mockNotice: string;
  requirements: RoleRequirement;
  interviewStages: InterviewStage[];
  scoringRubric: ScoringDimension[];
  questionBank: BankQuestion[];
  source: 'user_jd' | 'authorized_api' | 'company_feed' | 'mock';
  rawDescription: string;
  sourceUrl?: string;
  company?: string;
  location?: string;
  salary?: string;
  experienceLevel?: string;
  publishedAt?: string;
  fetchedAt: string;
  expiresAt?: string;
}

/** 业务服务可处理的职业方向或具体岗位。 */
export type RoleTarget = RoleProfile | JobPosting;

/** 兼容旧模块的类型名，新的代码应优先使用 RoleTarget。 */
export type Role = RoleTarget;

export interface RoleRecommendation {
  role: RoleProfile;
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  recommendation: 'high' | 'medium' | 'low';
  matchedSkills: string[];
  gaps: string[];
  evidence: string[];
  /** 推荐理由，供推荐卡片直接展示。 */
  reason: string;
  /** 与技能匹配对应的简历原文证据。 */
  skillEvidence: { skill: string; quote: string }[];
  /** 缺口对应的下一步补齐建议。 */
  gapDetails: { skill: string; why: string; nextStep: string }[];
}

export interface RecommendationRecord {
  id: string;
  resumeText: string;
  recommendations: RoleRecommendation[];
  createdAt: string;
}

export interface RoleSnapshot {
  id: string;
  referenceId: string;
  context: 'recommendation' | 'resume_analysis' | 'interview_session';
  roleId: string;
  role: RoleTarget;
  createdAt: string;
}

// ===== 简历分析 =====

export interface ExtractedProject {
  name: string;
  description: string;
  stack: string[];
  results: string;
}

export interface ExtractedFields {
  education: string;
  skills: string[];
  projects: ExtractedProject[];
  achievements: string[];
}

/** 单条岗位缺口：岗位要求 / 简历现状 / 问题 / 建议 / 证据 */
export interface ResumeGap {
  requirement: string;
  current: string;
  problem: string;
  suggestion: string;
  evidence: string;
}

export interface ResumeSuggestion {
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
}

export interface ResumeAnalysis {
  id: string;
  roleId: string;
  /** 分析时的岗位快照，避免岗位配置更新后历史结果失真。 */
  roleSnapshot?: RoleTarget;
  resumeText: string;
  extractedFields: ExtractedFields;
  /** 岗位匹配分 0-100 */
  matchingScore: number;
  matchedSkills: string[];
  gaps: ResumeGap[];
  /** 空泛表述 / 缺少量化结果的问题 */
  vagueIssues: string[];
  /** 三条按优先级排序的修改建议 */
  suggestions: ResumeSuggestion[];
  /** 分析来源：llm = 大模型，rule = 规则兜底 */
  source: 'llm' | 'rule';
  createdAt: string;
}

// ===== 面试 =====

export interface FollowUp {
  id: string;
  text: string;
  /** 追问依据（为何追问） */
  reason: string;
  answer?: string;
  source: 'llm' | 'rule';
}

export interface AskedQuestion {
  id: string;
  stageId: string;
  stageName: string;
  text: string;
  source: 'bank' | 'llm';
  tags: string[];
  answer?: string;
  followUps: FollowUp[];
  /** 本题（含追问）的维度评分 */
  dimensionScores?: DimensionScore[];
}

/** 程序生成的提问计划（面试状态机按此推进） */
export interface StagePlanItem {
  stageId: string;
  stageName: string;
  text: string;
  source: 'bank' | 'llm';
  tags: string[];
}

export interface InterviewSession {
  id: string;
  roleId: string;
  roleName: string;
  /** 开始面试时保存的岗位快照。 */
  roleSnapshot?: RoleTarget;
  resumeAnalysisId: string;
  /** 1 = 首轮训练，2 = 再次挑战 */
  round: number;
  /** 再次挑战所依据的首轮训练 */
  basedOnSessionId?: string;
  /** 再次挑战聚焦的薄弱维度 */
  focusWeaknesses?: string[];
  plan: StagePlanItem[];
  currentPlanIndex: number;
  questions: AskedQuestion[];
  status: 'active' | 'completed' | 'abandoned';
  closingMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

// ===== 评分 =====

export interface DimensionScore {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  /** 回答证据片段 */
  evidence: string;
  suggestion: string;
  source: 'llm' | 'rule';
}

// ===== 复盘报告 =====

export interface DimensionDelta {
  name: string;
  before: number;
  after: number;
  delta: number;
  weight: number;
  maxScore: number;
}

export interface ComparisonData {
  baseSessionId: string;
  baseOverallScore: number;
  currentOverallScore: number;
  dimensionDeltas: DimensionDelta[];
  improved: string[];
  remaining: string[];
  nextSuggestions: string[];
}

export interface NextChallenge {
  focusAreas: string[];
  description: string;
  recommendedQuestions: string[];
}

export interface ReviewReport {
  id: string;
  sessionId: string;
  roleId: string;
  roleName: string;
  round: number;
  /** 模拟表现分（后端固定公式计算，不是录取概率） */
  overallScore: number;
  /** 岗位准备度描述 */
  jobReadiness: string;
  dimensionScores: DimensionScore[];
  /** 主要失分原因 */
  mainIssues: string[];
  /** 回答证据片段 */
  evidence: string[];
  /** 下一轮训练建议 */
  nextStepSuggestions: string[];
  nextChallenge: NextChallenge;
  /** 第二轮报告附带两次训练对比 */
  comparison?: ComparisonData;
  source: 'llm' | 'rule';
  createdAt: string;
}

// ===== 训练记录 =====

export interface SessionSummary {
  id: string;
  roleId: string;
  roleName: string;
  round: number;
  status: InterviewSession['status'];
  startedAt: string;
  finishedAt?: string;
  questionCount: number;
  overallScore?: number;
}

/**
 * 训练记录存储接口（方案 5.2「训练记录服务」）
 * 实现见 src/lib/store/：内存版（默认）与 PostgreSQL 版（DATABASE_URL 启用）
 */
export interface Store {
  kind: 'memory' | 'postgres';
  saveResumeAnalysis(a: ResumeAnalysis): Promise<void>;
  getResumeAnalysis(id: string): Promise<ResumeAnalysis | null>;
  saveSession(s: InterviewSession): Promise<void>;
  getSession(id: string): Promise<InterviewSession | null>;
  saveReport(r: ReviewReport): Promise<void>;
  getReportBySession(sessionId: string): Promise<ReviewReport | null>;
  listSessions(): Promise<SessionSummary[]>;
  /** 级联删除训练记录（隐私：用户可删除自己的训练数据） */
  deleteRecord(sessionId: string): Promise<boolean>;
  saveJobPosting(job: JobPosting): Promise<void>;
  getJobPosting(id: string): Promise<JobPosting | null>;
  listJobPostings(): Promise<JobPosting[]>;
  saveRecommendation(record: RecommendationRecord): Promise<void>;
  saveRoleSnapshot(snapshot: RoleSnapshot): Promise<void>;
}
