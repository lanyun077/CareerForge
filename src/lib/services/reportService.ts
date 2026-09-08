/**
 * 复盘报告服务（方案 3.5 / 3.6）
 *
 * 维度得分由后端跨题聚合 + 固定公式计算；大模型只负责把失分原因、
 * 训练建议和专项挑战组织成可执行文案（失败时用规则模板）。
 * 第二轮报告附带两次训练对比（方案 3.6）。
 */

import { randomUUID } from 'crypto';
import { ServiceError } from '@/lib/api';
import { chatJSON } from '@/lib/llm/client';
import { REPORT_NARRATIVE_SYSTEM } from '@/lib/llm/prompts';
import { validateReportNarrative, type ReportNarrative } from '@/lib/llm/validate';
import { getRole } from '@/lib/roles';
import { getStore } from '@/lib/store/memoryStore';
import type {
  ComparisonData,
  DimensionDelta,
  DimensionScore,
  InterviewSession,
  ReviewReport,
  Role,
} from '@/lib/types';
import { DIM_TAGS } from './interviewService';
import { computeOverall } from './scoringService';

const DIM_ADVICE: Record<string, string> = {
  structure: '用 STAR（背景-任务-行动-结果）重写每段项目描述，回答时先给结论再展开',
  specificity: '每个项目准备 2-3 个量化结果（数据量、性能变化、用户规模），并说明测量方式',
  relevance: '对照岗位必备技能逐条自检，删掉无关内容，把时间花在后端能力上',
  evidence: '为每个项目准备可追问的细节：模块划分、技术选型原因、遇到的坑和验证方式',
  tech: '复习岗位必备技能对应的基础原理，练习 3 道场景设计题并写下完整思路',
};

/** 生成（或返回缓存的）复盘报告 */
export async function buildReport(sessionId: string): Promise<ReviewReport> {
  const store = getStore();
  const cached = store.getReportBySession(sessionId);
  if (cached) return cached;

  const session = store.getSession(sessionId);
  if (!session) throw new ServiceError('训练会话不存在', 404);
  if (session.status !== 'completed') {
    throw new ServiceError('本次训练尚未完成，完成全部问题后才能生成复盘报告', 409);
  }
  const role = getRole(session.roleId);
  if (!role) throw new ServiceError('岗位配置不存在', 500);
  const analysis = store.getResumeAnalysis(session.resumeAnalysisId);

  // 跨题聚合各维度分（取平均），证据取该维度得分最低一题的证据
  const dims: DimensionScore[] = role.scoringRubric.map((rd) => {
    const perQ: DimensionScore[] = [];
    for (const q of session.questions) {
      const d = q.dimensionScores?.find((x) => x.id === rd.id);
      if (d) perQ.push(d);
    }
    const avg = perQ.length ? perQ.reduce((s, d) => s + d.score, 0) / perQ.length : 0;
    const worst = perQ.slice().sort((a, b) => a.score - b.score).find((d) => d.evidence);
    const firstAnswer = session.questions.find((q) => q.answer)?.answer;
    const evidence =
      worst?.evidence ??
      (firstAnswer ? `回答片段：「${firstAnswer.slice(0, 40)}…」` : '未采集到回答证据');
    return {
      id: rd.id,
      name: rd.name,
      score: Math.round(avg * 10) / 10,
      maxScore: rd.maxScore,
      weight: rd.weight,
      evidence,
      suggestion: worst?.suggestion || DIM_ADVICE[rd.id] || '结合岗位要求补充具体细节与结果',
      source: perQ.some((d) => d.source === 'llm') ? 'llm' : 'rule',
    };
  });

  const overallScore = computeOverall(dims);
  const sorted = dims.slice().sort((a, b) => a.score / a.maxScore - b.score / b.maxScore);
  const weakest = sorted[0];
  const jobReadiness = readinessText(overallScore, weakest.name);

  // 规则版文案（兜底）
  const ruleMainIssues = sorted
    .slice(0, 2)
    .map((d) => `${d.name}偏弱（${d.score}/${d.maxScore}）：${d.suggestion}`);
  const ruleNext = sorted.slice(0, 2).map((d) => DIM_ADVICE[d.id] ?? d.suggestion);
  const ruleChallenge = buildNextChallenge(role, sorted);

  // LLM 文案（可选增强；失败用规则模板）
  const narrative = await chatJSON<ReportNarrative>({
    system: REPORT_NARRATIVE_SYSTEM,
    user: buildNarrativeUserPrompt(role, session, dims, overallScore),
    temperature: 0.4,
    validate: validateReportNarrative,
  });

  // 第二轮：与首轮报告对比（方案 3.6）
  let comparison: ComparisonData | undefined;
  if (session.round === 2 && session.basedOnSessionId) {
    const baseReport = store.getReportBySession(session.basedOnSessionId);
    if (baseReport) {
      const deltas: DimensionDelta[] = dims.map((d) => {
        const before = baseReport.dimensionScores.find((x) => x.id === d.id)?.score ?? 0;
        return {
          name: d.name,
          before,
          after: d.score,
          delta: Math.round((d.score - before) * 10) / 10,
          weight: d.weight,
          maxScore: d.maxScore,
        };
      });
      comparison = {
        baseSessionId: baseReport.sessionId,
        baseOverallScore: baseReport.overallScore,
        currentOverallScore: overallScore,
        dimensionDeltas: deltas,
        improved: deltas.filter((d) => d.delta >= 0.3).map((d) => d.name),
        remaining: deltas.filter((d) => d.after / d.maxScore < 0.6).map((d) => d.name),
        nextSuggestions: narrative?.nextStepSuggestions ?? ruleNext,
      };
    }
  }

  const report: ReviewReport = {
    id: randomUUID(),
    sessionId,
    roleId: role.id,
    roleName: role.name,
    round: session.round,
    overallScore,
    jobReadiness,
    dimensionScores: dims,
    mainIssues: narrative?.mainIssues ?? ruleMainIssues,
    evidence: dims
      .filter((d) => d.evidence)
      .slice(0, 3)
      .map((d) => `${d.name}：「${d.evidence}」`),
    nextStepSuggestions: narrative?.nextStepSuggestions ?? ruleNext,
    nextChallenge: {
      focusAreas: narrative?.nextChallenge?.focusAreas?.length
        ? narrative.nextChallenge.focusAreas
        : ruleChallenge.focusAreas,
      description: narrative?.nextChallenge?.description || ruleChallenge.description,
      // 推荐问题固定来自题库，保证第二轮“再次挑战”始终可用
      recommendedQuestions: ruleChallenge.recommendedQuestions,
    },
    comparison,
    source: narrative ? 'llm' : 'rule',
    createdAt: new Date().toISOString(),
  };
  store.saveReport(report);
  return report;
}

function readinessText(overall: number, weakestName: string): string {
  if (overall >= 85) return `与模拟岗位要求匹配度较高，可以开始针对性冲刺；相对薄弱的是「${weakestName}」`;
  if (overall >= 70) return `基本匹配模拟岗位要求，主要短板集中在「${weakestName}」等维度`;
  if (overall >= 50) return `与模拟岗位要求有明显差距，建议优先补齐「${weakestName}」`;
  return `与模拟岗位要求差距较大，建议从必备技能与项目经历开始系统准备，当前最弱的是「${weakestName}」`;
}

function buildNextChallenge(
  role: Role,
  sortedDims: DimensionScore[],
): { focusAreas: string[]; description: string; recommendedQuestions: string[] } {
  const weak = sortedDims.slice(0, 2);
  const dimIds = new Set(weak.map((d) => d.id));
  const tags = [...dimIds].flatMap((id) => DIM_TAGS[id] ?? []);

  const focusAreas = weak.map((d) => d.name);
  const description = `本次专项挑战聚焦「${focusAreas.join('、')}」两个薄弱维度：会围绕你的简历项目和上一轮回答缺口重新出题，共 ${Math.min(
    4,
    role.interviewStages.length,
  )} 题左右，重点验证上一轮暴露的问题是否改善。`;

  const recommended = role.questionBank
    .filter((q) => q.tags.some((t) => tags.includes(t)) && q.stage !== 'wrap')
    .slice(0, 3)
    .map((q) => q.text);

  return { focusAreas, description, recommendedQuestions: recommended };
}

function buildNarrativeUserPrompt(
  role: Role,
  session: InterviewSession,
  dims: DimensionScore[],
  overall: number,
): string {
  const dimsText = dims
    .map((d) => `- ${d.name}：${d.score}/${d.maxScore}（权重 ${d.weight * 100}%），证据：${d.evidence}`)
    .join('\n');
  return [
    `【岗位】${role.name}（模拟岗位）`,
    `【第 ${session.round} 轮训练 · 模拟表现分】${overall}/100`,
    `【各维度得分与证据】\n${dimsText}`,
    session.round === 2 ? `【本轮聚焦的薄弱维度】${(session.focusWeaknesses ?? []).join('、')}` : '',
    '请按系统提示的 JSON 格式输出复盘文案。',
  ]
    .filter(Boolean)
    .join('\n\n');
}
