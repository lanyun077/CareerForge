/**
 * 面试状态机（方案 3.3 / 3.4 / 6.1）
 *
 * 程序负责控制：当前阶段、问题总数、每题追问次数（配置上限 0/1/2）、已问问题、结束条件。
 * 大模型只在限定范围内生成问题与追问；任何模型调用失败都降级到固定题库 /
 * 规则追问，不允许流程中断。
 */

import { randomUUID } from 'crypto';
import { sharePending } from './pendingWork';
import { configureInterviewRole, parseInterviewSettings } from '@/lib/interviewSettings';
import { ServiceError } from '@/lib/api';
import { chatJSON } from '@/lib/llm/client';
import { FOLLOWUP_SYSTEM, INTERVIEW_PLAN_SYSTEM } from '@/lib/llm/prompts';
import {
  validateFollowUp,
  validatePlanQuestions,
  type PlanQuestion,
} from '@/lib/llm/validate';
import { getTargetRole } from './roleService';
import { getStore } from '@/lib/store/memoryStore';
import type {
  AskedQuestion,
  FollowUp,
  InterviewSession,
  ResumeAnalysis,
  RoleTarget,
  StagePlanItem,
} from '@/lib/types';
import { scoreQuestion } from './scoringService';

export interface StartSessionParams {
  settings?: unknown;
  roleId: string;
  resumeAnalysisId: string;
  round?: number;
  basedOnSessionId?: string;
}

/** 开场：生成提问计划并落库，返回含第一题的会话 */
export async function startSession(params: StartSessionParams): Promise<InterviewSession> {
  const round = params.round === 2 ? 2 : 1;
  let focusWeaknesses: string[] = [];
  let previousQuestions: string[] = [];
  let settings = parseInterviewSettings(params.settings);

  const store = getStore();
  let analysis = params.resumeAnalysisId
    ? await store.getResumeAnalysis(params.resumeAnalysisId)
    : null;

  if (round === 2) {
    if (!params.basedOnSessionId) {
      throw new ServiceError('再次挑战需要提供首轮训练的 sessionId', 400);
    }
    const baseReport = await store.getReportBySession(params.basedOnSessionId);
    if (!baseReport) {
      throw new ServiceError('未找到首轮复盘报告，无法生成专项挑战', 404);
    }
    focusWeaknesses = baseReport.nextChallenge.focusAreas;
    const baseSession = await store.getSession(params.basedOnSessionId);
    if (!baseSession || baseSession.round !== 1 || baseSession.status !== 'completed') {
      throw new ServiceError('专项挑战需要已完成的首轮训练', 409);
    }
    if (analysis && analysis.id !== baseSession.resumeAnalysisId) {
      throw new ServiceError('专项挑战必须使用首轮简历与岗位', 422);
    }
    previousQuestions = baseSession.questions.flatMap((q) => [q.text, ...q.followUps.map((fu) => fu.text)]);
    settings = parseInterviewSettings(baseSession.settings);
    // 再次挑战未显式提供简历分析时，从首轮会话继承
    if (!analysis) {
      analysis = await store.getResumeAnalysis(baseSession.resumeAnalysisId);
    }
  }

  if (!analysis) {
    throw new ServiceError('简历分析记录不存在，请先完成简历分析', 404);
  }
  const role = analysis.roleSnapshot ?? await getTargetRole(analysis.roleId);
  if (!role) throw new ServiceError('岗位配置不存在', 500);

  const trainingRole = configureInterviewRole(role, settings);
  const plan = await buildPlan(trainingRole, analysis, { round, focusWeaknesses, previousQuestions, difficulty: settings.difficulty });
  if (plan.length !== settings.questionCount) throw new ServiceError('题库不足，请调整题数', 422);

  const session: InterviewSession = {
    id: randomUUID(),
    settings,
    roleId: role.id,
    roleName: role.name,
    roleSnapshot: role,
    resumeAnalysisId: analysis.id,
    round,
    basedOnSessionId: round === 2 ? params.basedOnSessionId : undefined,
    focusWeaknesses: round === 2 ? focusWeaknesses : undefined,
    plan,
    currentPlanIndex: 0,
    questions: [materialize(plan[0])],
    status: 'active',
    startedAt: new Date().toISOString(),
  };
  await store.saveSession(session, [{
    id: randomUUID(),
    referenceId: session.id,
    context: 'interview_session',
    roleId: role.id,
    role,
    createdAt: session.startedAt,
  }]);
  return session;
}

/** 提交回答：判断追问 → 推进计划 → 评分 → 结束判定 */
export async function submitAnswer(
  sessionId: string,
  rawAnswer: string,
  questionId: string,
): Promise<{ session: InterviewSession; event: 'followUp' | 'question' | 'completed' }> {
  const answer = rawAnswer.trim().slice(0, 5000);
  return sharePending(getStore(), JSON.stringify(['answer', sessionId, questionId, answer]), () => processAnswer(sessionId, answer, questionId));
}

async function processAnswer(
  sessionId: string,
  rawAnswer: string,
  questionId: string,
): Promise<{ session: InterviewSession; event: 'followUp' | 'question' | 'completed' }> {
  const store = getStore();
  const session = await store.getSession(sessionId);
  if (!session) throw new ServiceError('训练会话不存在', 404);

  const answer = rawAnswer.trim().slice(0, 5000);
  if (!answer) throw new ServiceError('回答内容不能为空', 422);

  const replay = replayAnswer(session, questionId, answer);
  if (replay) return replay;
  const previousQuestions = structuredClone(session.questions);

  const analysis = await store.getResumeAnalysis(session.resumeAnalysisId);
  const q = session.questions[session.questions.length - 1];
  if (!q) throw new ServiceError('会话状态异常', 500);

  let event: 'followUp' | 'question' | 'completed';

  if (q.answer === undefined) {
    // 首次回答本题：判断是否追问（按会话配置限制次数）
    q.answer = answer;
    if ((session.settings?.maxFollowUps ?? 1) > 0 && q.followUps.length === 0) {
      const fu = await buildFollowUp(session, analysis, q, answer);
      if (fu) {
        q.followUps.push(fu);
        return persist('followUp');
      }
    }
    event = await advance(session, analysis, q);
  } else {
    // 回答的是追问
    const fu = q.followUps[q.followUps.length - 1];
    if (!fu || fu.answer !== undefined) throw new ServiceError('会话状态异常', 500);
    fu.answer = answer;
    if (q.followUps.length < (session.settings?.maxFollowUps ?? 1)) {
      const next = await buildFollowUp(session, analysis, q, answer);
      if (next && !q.followUps.some((previous) => normalizeQuestion(previous.text) === normalizeQuestion(next.text))) {
        q.followUps.push(next);
        return persist('followUp');
      }
    }
    event = await advance(session, analysis, q);
  }

  return persist(event);

  async function persist(event: 'followUp' | 'question' | 'completed') {
    if (await store.updateSession(session!, previousQuestions)) return { session: session!, event };
    const current = await store.getSession(sessionId);
    if (!current) throw new ServiceError('训练会话已删除，无法保存回答', 404);
    const replay = replayAnswer(current, questionId, answer);
    if (replay) return replay;
    throw new ServiceError('训练状态已更新，请刷新当前问题后重试', 409);
  }
}

/** 已接收的同一回答可以安全重试；不同的旧回答不能落到下一题。 */
function replayAnswer(session: InterviewSession, questionId: string, answer: string):
  { session: InterviewSession; event: 'followUp' | 'question' | 'completed' } | null {
  const target = session.questions.flatMap((q) => [q, ...q.followUps]).find((q) => q.id === questionId);
  if (target?.answer !== undefined) {
    if (target.answer !== answer) throw new ServiceError('该问题已有回答，请刷新查看最新训练状态；输入已保留', 409);
    const last = session.questions[session.questions.length - 1];
    return { session, event: session.status === 'completed' ? 'completed' : last.answer === undefined ? 'question' : 'followUp' };
  }
  const last = session.questions[session.questions.length - 1];
  const pending = last?.answer === undefined ? last : last.followUps.find((fu) => fu.answer === undefined);
  if (session.status !== 'active' || !pending || pending.id !== questionId) {
    throw new ServiceError('当前问题已变化或训练已结束，请刷新查看最新状态；输入已保留', 409);
  }
  return null;
}

// ---------- 计划生成 ----------

/** 薄弱维度 → 题库标签映射（第二轮选题 / 专项挑战推荐题共用） */
export const DIM_TAGS: Record<string, string[]> = {
  structure: ['STAR', '结构', '总结'],
  specificity: ['量化', '细节', '结果'],
  relevance: ['场景', '岗位相关'],
  evidence: ['项目'],
  tech: ['技术', '原理'],
};

async function buildPlan(
  role: RoleTarget,
  analysis: ResumeAnalysis,
  opts: { round: number; focusWeaknesses: string[]; previousQuestions: string[]; difficulty?: string },
): Promise<StagePlanItem[]> {
  const bankPlan = selectFromBank(role, opts);

  // 大模型个性化出题（失败 / 未配置时直接用题库）
  const llmQuestions = await chatJSON<PlanQuestion[]>({
    system: INTERVIEW_PLAN_SYSTEM,
    user: buildPlanUserPrompt(role, analysis, opts, [...opts.previousQuestions, ...bankPlan.map((b) => b.text)]),
    temperature: 0.5,
    timeoutMs: 20_000,
    validate: (raw) => validatePlanQuestions(raw, role),
  });
  if (!llmQuestions) return bankPlan;

  const llmByStage = new Map<string, PlanQuestion[]>();
  for (const lq of llmQuestions) {
    const arr = llmByStage.get(lq.stageId) ?? [];
    arr.push(lq);
    llmByStage.set(lq.stageId, arr);
  }

  const used = new Set(opts.previousQuestions.map(normalizeQuestion));
  return bankPlan.map((slot) => {
    const candidate = llmByStage.get(slot.stageId)?.shift();
    const dupOfBank = candidate && bankPlan.some((b) => b.text === candidate.text);
    const nearDup = candidate && candidate.text.slice(0, 15) === slot.text.slice(0, 15);
    if (candidate && !dupOfBank && !nearDup && !used.has(normalizeQuestion(candidate.text))) {
      used.add(normalizeQuestion(candidate.text));
      return {
        stageId: slot.stageId,
        stageName: slot.stageName,
        text: candidate.text,
        source: 'llm' as const,
        tags: candidate.tags,
      };
    }
    used.add(normalizeQuestion(slot.text));
    return slot;
  });
}

/** 从固定题库选题（兜底通道；第二轮按薄弱维度标签过滤） */
export function selectFromBank(
  role: RoleTarget,
  opts: { round: number; focusWeaknesses: string[]; previousQuestions: string[]; difficulty?: string },
): StagePlanItem[] {
  const dimIds = new Set<string>();
  for (const name of opts.focusWeaknesses) {
    const dim = role.scoringRubric.find((d) => d.name === name || d.id === name);
    if (dim) dimIds.add(dim.id);
  }
  const focusTags = [...dimIds].flatMap((id) => DIM_TAGS[id] ?? []);

  const plan: StagePlanItem[] = [];
  const previous = new Set(opts.previousQuestions.map(normalizeQuestion));
  for (const stage of role.interviewStages) {
    const pool = shuffle(role.questionBank.filter((q) => q.stage === stage.id));
    const priority = (q: typeof pool[number]) =>
      (previous.has(normalizeQuestion(q.text)) ? 2 : 0) +
      (q.tags.some((t) => focusTags.includes(t)) ? 0 : 1);
    if (opts.round === 2) pool.sort((a, b) => priority(a) - priority(b));
    const unique = pool.filter((q, i) => pool.findIndex((other) => normalizeQuestion(other.text) === normalizeQuestion(q.text)) === i);
    for (const q of unique.slice(0, stage.questionCount)) {
      plan.push({ stageId: stage.id, stageName: stage.name, text: q.text, source: 'bank', tags: q.tags });
    }
  }
  return plan;
}

function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

function buildPlanUserPrompt(
  role: RoleTarget,
  analysis: ResumeAnalysis,
  opts: { round: number; focusWeaknesses: string[]; difficulty?: string },
  bankTexts: string[],
): string {
  const stages = role.interviewStages
    .map((s) => `- stageId=${s.id}（${s.name}），出 ${s.questionCount} 题`)
    .join('\n');
  const projects = analysis.extractedFields.projects
    .map((p) => `项目「${p.name}」：${p.description.slice(0, 80)}`)
    .join('\n');
  return [
    `【训练要求】${opts.difficulty === 'advanced' ? '要求比较方案、边界、失败场景和验证方法' : opts.difficulty === 'basic' ? '以基本概念和简单实例为主' : '标准岗位实践问题'}`,
    `【面试阶段计划】\n${stages}`,
    `【岗位】${role.name}\n必备技能：${role.requirements.requiredSkills.map((s) => s.label).join('、')}`,
    `【简历关键信息】\n${projects || analysis.resumeText.slice(0, 800)}`,
    opts.round === 2
      ? `【第二轮专项挑战】必须围绕以下薄弱维度出题：${opts.focusWeaknesses.join('、')}`
      : '',
    `【不得重复的已有题目】\n${bankTexts.join('\n')}`,
    '请按系统提示的 JSON 格式输出问题计划。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ---------- 追问生成 ----------

async function buildFollowUp(
  session: InterviewSession,
  analysis: ResumeAnalysis | null,
  q: AskedQuestion,
  answer: string,
): Promise<FollowUp | null> {
  // 总结题不追问
  if (q.stageId === 'wrap') return null;

  const role = analysis?.roleSnapshot ?? session.roleSnapshot ?? await getTargetRole(session.roleId);
  if (!role) return null;

  const asked = session.questions.flatMap((x) => [x.text, ...x.followUps.map((fu) => fu.text)]);
  const llm = await chatJSON<{ needed: boolean; text: string; reason: string }>({
    system: FOLLOWUP_SYSTEM,
    user: buildFollowUpUserPrompt(role, analysis, q, answer, asked),
    temperature: 0.4,
    timeoutMs: 20_000,
    validate: (raw) => validateFollowUp(raw, [
      { id: q.id, text: answer },
      { id: analysis?.id ?? 'resume', text: analysis?.resumeText ?? '' },
    ]),
  });
  if (llm) {
    if (!llm.needed) return null;
    return { id: randomUUID(), text: llm.text, reason: llm.reason, source: 'llm' };
  }
  const rule = ruleFollowUp(q, answer, analysis);
  return rule ? { id: randomUUID(), text: rule.text, reason: rule.reason, source: 'rule' } : null;
}

/** 规则兜底追问：必须引用候选人回答或简历内容（方案 3.4 合格追问标准） */
function ruleFollowUp(
  _q: AskedQuestion,
  answer: string,
  analysis: ResumeAnalysis | null,
): { text: string; reason: string } | null {
  const hasNumbers = /\d/.test(answer);
  const vagueMatch = answer.match(/(大概|可能|差不多|一些|部分|还行|还好|基本)/);
  // 回答已足够具体（有数据、无模糊词、篇幅充分）则不追问
  if (answer.length >= 60 && hasNumbers && !vagueMatch) return null;

  const snippet = answer.length > 24 ? answer.slice(0, 24) : answer;
  const projectName = analysis?.extractedFields.projects[0]?.name ?? '简历中的项目';

  if (vagueMatch) {
    return {
      text: `你刚才说「${snippet}」，其中「${vagueMatch[1]}」具体指什么？请结合「${projectName}」说明你实际做了哪些操作、遇到什么问题、最后结果如何。`,
      reason: '回答存在模糊表述，需要结合简历中的具体项目澄清',
    };
  }
  if (!hasNumbers) {
    return {
      text: `你提到「${snippet}」。能否补充具体的量化结果？比如数据规模、性能指标（响应时间、QPS）或用户量的变化，以及你是如何测量和验证的？`,
      reason: '回答缺少量化结果与验证方式',
    };
  }
  return {
    text: `结合「${projectName}」项目：你刚才提到「${snippet}」，请展开说明你在其中的具体职责、关键步骤和最终效果。`,
    reason: '回答需要结合简历项目补充事实、过程与结果',
  };
}

function buildFollowUpUserPrompt(
  role: RoleTarget,
  analysis: ResumeAnalysis | null,
  q: AskedQuestion,
  answer: string,
  asked: string[],
): string {
  return [
    `【岗位】${role.name}\n必备技能：${role.requirements.requiredSkills.map((s) => s.label).join('、')}`,
    `【简历关键内容】\n${(analysis?.resumeText ?? '').slice(0, 1200)}`,
    `【当前问题】\n${q.text}`,
    `【候选人回答】\n${answer.slice(0, 2000)}`,
    `【本次面试已问过的问题（禁止重复）】\n${asked.join('\n')}`,
    '请判断是否需要一次追问，并按系统提示的 JSON 格式输出。',
  ].join('\n\n');
}

// ---------- 状态推进 ----------

async function advance(
  session: InterviewSession,
  analysis: ResumeAnalysis | null,
  q: AskedQuestion,
): Promise<'question' | 'completed'> {
  const role = analysis?.roleSnapshot ?? session.roleSnapshot ?? await getTargetRole(session.roleId);
  if (!role) throw new ServiceError('岗位配置不存在', 500);
  // 本题（含追问）评分——失败自动降级为规则评分
  q.dimensionScores = await scoreQuestion(role, analysis, q);

  session.currentPlanIndex += 1;
  if (session.currentPlanIndex < session.plan.length) {
    session.questions.push(materialize(session.plan[session.currentPlanIndex]));
    return 'question';
  }
  session.status = 'completed';
  session.finishedAt = new Date().toISOString();
  session.closingMessage = '本次训练已结束，可以生成复盘报告了。';
  return 'completed';
}

function materialize(item: StagePlanItem): AskedQuestion {
  return {
    id: randomUUID(),
    stageId: item.stageId,
    stageName: item.stageName,
    text: item.text,
    source: item.source,
    tags: item.tags,
    followUps: [],
  };
}

// ---------- 工具 ----------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
