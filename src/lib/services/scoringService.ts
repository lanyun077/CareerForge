/**
 * 评分服务（方案 4.1 / 4.2）
 *
 * 大模型只输出「维度评分建议 + 理由 + 证据」；
 * 最终得分一律由后端按固定权重公式计算，保证可解释、可复现。
 */

import type { AskedQuestion, DimensionScore, ResumeAnalysis, RoleTarget } from '@/lib/types';
import { chatJSON } from '@/lib/llm/client';
import { SCORING_SYSTEM } from '@/lib/llm/prompts';
import { validateScoring } from '@/lib/llm/validate';

/** 模拟表现分 = Σ (维度分 / 维度满分 × 维度权重) × 100，保留 1 位小数 */
export function computeOverall(dims: { score: number; maxScore: number; weight: number }[]): number {
  const total = dims.reduce((sum, d) => sum + (d.score / d.maxScore) * d.weight, 0);
  return Math.round(total * 1000) / 10;
}

const RULE_SUGGESTIONS: Record<string, string> = {
  structure: '用 STAR 结构重述：先说背景和目标，再说你的任务、具体行动，最后说结果',
  specificity: '补充具体模块名、数据规模和量化结果（响应时间、QPS、用户量等）',
  relevance: '把回答聚焦到岗位关心的能力：接口设计、数据库、服务稳定性',
  evidence: '给出能证明你亲手做的细节：模块划分、代码结构、遇到的问题和解决过程',
  tech: '先补全概念定义与原理，再结合一个实际使用场景说明',
};

/** 对一道题（含追问回答）评分：LLM 优先，失败 / 部分缺失时用规则兜底补齐 */
export async function scoreQuestion(
  role: RoleTarget,
  analysis: ResumeAnalysis | null,
  q: AskedQuestion,
): Promise<DimensionScore[]> {
  const merged = mergeAnswer(q);
  const llmDims = await chatJSON<(Omit<DimensionScore, 'source'> | null)[]>({
    system: SCORING_SYSTEM,
    user: buildScoringUserPrompt(role, analysis, q, merged),
    temperature: 0.1,
    validate: (raw) => validateScoring(raw, role),
  });

  if (llmDims) {
    return role.scoringRubric.map((rd, i) => {
      const fromLLM = llmDims[i];
      if (fromLLM) return { ...fromLLM, source: 'llm' as const };
      return ruleScoreOne(role, rd.id, merged);
    });
  }
  return role.scoringRubric.map((rd) => ruleScoreOne(role, rd.id, merged));
}

/** 规则兜底评分：基于回答特征（长度 / 数字 / STAR 关键词 / 技术词覆盖），
 *  上限 4 分——规则不给满分，避免虚高 */
function ruleScoreOne(role: RoleTarget, dimId: string, merged: string): DimensionScore {
  const rd = role.scoringRubric.find((d) => d.id === dimId)!;
  const len = merged.length;
  const hasNumbers = /\d/.test(merged);
  const hasResult = /(结果|效果|提升|下降|降低|优化|上线|覆盖率|成功)/.test(merged);
  const hasAction = /(负责|实现|搭建|开发|设计|编写|部署|修复|重构|调研)/.test(merged);
  const hasStar = /(背景|目标|任务|方案|结果|最后|最终)/.test(merged);
  const hasReasoning = /(因为|所以|原理|流程|结构|导致|从而)/.test(merged);
  const lower = merged.toLowerCase();
  const techHits = role.requirements.requiredSkills.filter((s) =>
    s.keywords.some((k) => lower.includes(k.toLowerCase())),
  ).length;

  let score = 1;
  switch (dimId) {
    case 'structure':
      score = 1 + (hasStar ? 1 : 0) + (hasAction ? 1 : 0) + (len > 80 ? 1 : 0);
      break;
    case 'specificity':
      score = 1 + (hasNumbers ? 1 : 0) + (hasResult ? 1 : 0) + (len > 120 ? 1 : 0);
      break;
    case 'relevance':
      score = 1 + (techHits >= 1 ? 1 : 0) + (techHits >= 2 ? 1 : 0) + (hasResult ? 1 : 0);
      break;
    case 'evidence':
      score = 1 + (hasAction ? 2 : 0) + (hasNumbers ? 1 : 0);
      break;
    case 'tech':
      score = 1 + (techHits >= 1 ? 1 : 0) + (hasReasoning ? 1 : 0) + (hasNumbers ? 1 : 0);
      break;
  }
  score = Math.min(4, Math.max(1, score));

  const snippet = len > 40 ? `${merged.slice(0, 40)}…` : merged;
  return {
    id: rd.id,
    name: rd.name,
    score,
    maxScore: rd.maxScore,
    weight: rd.weight,
    evidence: len ? `回答片段：「${snippet}」` : '未采集到回答内容',
    suggestion: RULE_SUGGESTIONS[dimId] ?? '结合岗位要求补充具体细节与结果',
    source: 'rule',
  };
}

// ---------- 辅助 ----------

function mergeAnswer(q: AskedQuestion): string {
  const parts = [q.answer ?? ''];
  for (const fu of q.followUps) {
    if (fu.answer) parts.push(`【追问】${fu.text}\n【追问回答】${fu.answer}`);
  }
  return parts.filter(Boolean).join('\n').trim();
}

function buildScoringUserPrompt(
  role: RoleTarget,
  analysis: ResumeAnalysis | null,
  q: AskedQuestion,
  merged: string,
): string {
  const rubric = role.scoringRubric
    .map((d) => `- ${d.name}（满分 ${d.maxScore}，权重 ${d.weight * 100}%）：${d.focus}`)
    .join('\n');
  const followUps = q.followUps
    .map((f) => `追问：${f.text}${f.answer ? `\n追问回答：${f.answer}` : '（未回答）'}`)
    .join('\n');
  return `【评分维度】\n${rubric}\n\n【简历摘要】\n${(analysis?.resumeText ?? '').slice(0, 1200)}\n\n【问题】\n${q.text}\n\n【候选人回答】\n${merged.slice(0, 3000)}\n\n${followUps}\n\n请对每个维度打分并给出证据，输出全部 ${role.scoringRubric.length} 个维度。`;
}
