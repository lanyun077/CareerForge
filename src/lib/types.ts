/**
 * CareerForge 核心数据结构
 * 对应项目方案 5.3：Role / ResumeAnalysis / InterviewSession / ReviewReport
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

export interface Role {
  id: string;
  name: string;
  description: string;
  /** 是否为模拟岗位 */
  isMock: boolean;
  mockNotice: string;
  requirements: RoleRequirement;
  interviewStages: InterviewStage[];
  scoringRubric: ScoringDimension[];
  questionBank: BankQuestion[];
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
