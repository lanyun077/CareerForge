/**
 * 大模型输出校验与归一化
 * 对应方案 4.2：后端校验分数范围、字段完整性和 JSON 格式，不合规即走兜底
 */

import type {
  DimensionScore,
  ResumeAnalysis,
  ResumeGap,
  ResumeSuggestion,
  RoleTarget,
} from '@/lib/types';

// ---------- 基础工具 ----------

export function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

export function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function asStringArray(v: unknown, limit = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- 简历分析 ----------

/** 模型输出不完整时用规则结果补齐（混合模式），确保结构完整 */
export function validateResumeAnalysis(
  raw: unknown,
  role: RoleTarget,
  base: Omit<ResumeAnalysis, 'source' | 'createdAt' | 'id' | 'roleId' | 'resumeText'>,
): Omit<ResumeAnalysis, 'source' | 'createdAt' | 'id' | 'roleId' | 'resumeText'> | null {
  const r = asRecord(raw);
  if (!r) return null;
  const ef = asRecord(r.extractedFields);
  const rawGaps = Array.isArray(r.gaps) ? r.gaps : [];
  const gaps: ResumeGap[] = rawGaps
    .map((g): ResumeGap | null => {
      const gr = asRecord(g);
      if (!gr) return null;
      const requirement = asString(gr.requirement);
      if (!requirement) return null;
      return {
        requirement,
        current: asString(gr.current),
        problem: asString(gr.problem),
        suggestion: asString(gr.suggestion),
        evidence: asString(gr.evidence),
      };
    })
    .filter((g): g is ResumeGap => g !== null)
    .slice(0, 6);

  const rawSug = Array.isArray(r.suggestions) ? r.suggestions : [];
  const suggestions: ResumeSuggestion[] = rawSug
    .map((s, i): ResumeSuggestion | null => {
      const sr = asRecord(s);
      if (!sr) return null;
      const title = asString(sr.title);
      if (!title) return null;
      const priority = clampNum(sr.priority, 1, 3, i + 1) as 1 | 2 | 3;
      return { priority, title, detail: asString(sr.detail) };
    })
    .filter((s): s is ResumeSuggestion => s !== null)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  const matchingScore = clampNum(r.matchingScore, 0, 100, base.matchingScore);

  return {
    ...base,
    extractedFields: {
      education: ef ? asString(ef.education) : base.extractedFields.education,
      skills: ef ? asStringArray(ef.skills) : base.extractedFields.skills,
      projects: ef && Array.isArray(ef.projects)
        ? ef.projects
            .map((p): { name: string; description: string; stack: string[]; results: string } | null => {
              const pr = asRecord(p);
              if (!pr) return null;
              const name = asString(pr.name);
              if (!name) return null;
              return {
                name,
                description: asString(pr.description),
                stack: asStringArray(pr.stack),
                results: asString(pr.results),
              };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .slice(0, 5)
        : base.extractedFields.projects,
      achievements: ef ? asStringArray(ef.achievements) : base.extractedFields.achievements,
    },
    matchedSkills: asStringArray(r.matchedSkills, 15).length
      ? asStringArray(r.matchedSkills, 15)
      : base.matchedSkills,
    gaps: gaps.length ? gaps : base.gaps,
    vagueIssues: asStringArray(r.vagueIssues, 6).length
      ? asStringArray(r.vagueIssues, 6)
      : base.vagueIssues,
    suggestions: suggestions.length ? suggestions : base.suggestions,
    matchingScore: round1(matchingScore),
  };
}

// ---------- 面试题生成 ----------

export interface PlanQuestion {
  stageId: string;
  text: string;
  tags: string[];
}

export function validatePlanQuestions(raw: unknown, role: RoleTarget): PlanQuestion[] | null {
  const r = asRecord(raw);
  if (!r || !Array.isArray(r.questions)) return null;
  const validStages = new Set(role.interviewStages.map((s) => s.id));
  const out: PlanQuestion[] = [];
  for (const q of r.questions) {
    const qr = asRecord(q);
    if (!qr) continue;
    const stageId = asString(qr.stageId);
    const text = asString(qr.text);
    if (!validStages.has(stageId) || text.length < 5 || text.length > 200) continue;
    out.push({ stageId, text, tags: asStringArray(qr.tags, 4) });
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
}

// ---------- 追问 ----------

export interface FollowUpResult {
  needed: boolean;
  text: string;
  reason: string;
}

export function validateFollowUp(raw: unknown): FollowUpResult | null {
  const r = asRecord(raw);
  if (!r) return null;
  const needed = r.needFollowUp === true;
  if (!needed) return { needed: false, text: '', reason: '' };
  const text = asString(r.text);
  if (text.length < 5 || text.length > 300) return null;
  return { needed: true, text, reason: asString(r.reason) || '针对回答中的信息缺口追问' };
}

// ---------- 评分 ----------

export interface ScoringResult {
  dims: Omit<DimensionScore, 'source'>[];
  confidence: string;
}

/** 必须覆盖岗位评分规则的全部维度；缺失的维度用 null 占位由调用方补齐 */
export function validateScoring(raw: unknown, role: RoleTarget): (Omit<DimensionScore, 'source'> | null)[] | null {
  const r = asRecord(raw);
  if (!r || !Array.isArray(r.dimensions)) return null;
  const byName = new Map<string, Record<string, unknown>>();
  for (const d of r.dimensions) {
    const dr = asRecord(d);
    if (!dr) continue;
    byName.set(asString(dr.name), dr);
  }
  const out: (Omit<DimensionScore, 'source'> | null)[] = role.scoringRubric.map((rd) => {
    const dr = byName.get(rd.name) ?? byName.get(rd.id);
    if (!dr) return null;
    const evidence = asString(dr.evidence);
    const suggestion = asString(dr.suggestion);
    const score = Math.round(clampNum(dr.score, 0, rd.maxScore, -1));
    if (score < 0) return null;
    return {
      id: rd.id,
      name: rd.name,
      score,
      maxScore: rd.maxScore,
      weight: rd.weight,
      evidence,
      suggestion,
    };
  });
  // 至少一半维度合法才可用模型结果
  const filled = out.filter((d) => d !== null).length;
  if (filled < Math.ceil(role.scoringRubric.length / 2)) return null;
  return out;
}

// ---------- 复盘报告文案 ----------

export interface ReportNarrative {
  mainIssues: string[];
  nextStepSuggestions: string[];
  nextChallenge?: { focusAreas: string[]; description: string; recommendedQuestions: string[] };
}

export function validateReportNarrative(raw: unknown): ReportNarrative | null {
  const r = asRecord(raw);
  if (!r) return null;
  const mainIssues = asStringArray(r.mainIssues, 4);
  const nextStepSuggestions = asStringArray(r.nextStepSuggestions, 4);
  if (!mainIssues.length || !nextStepSuggestions.length) return null;
  const ncRaw = asRecord(r.nextChallenge);
  const nextChallenge = ncRaw
    ? {
        focusAreas: asStringArray(ncRaw.focusAreas, 3),
        description: asString(ncRaw.description),
        recommendedQuestions: asStringArray(ncRaw.recommendedQuestions, 4),
      }
    : undefined;
  return { mainIssues, nextStepSuggestions, nextChallenge };
}
