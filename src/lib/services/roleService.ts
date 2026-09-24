import { jobContentHash, resolveJobProvenance } from '@/lib/jobProvenance';
import { randomUUID } from 'crypto';
import { chatJSON } from '@/lib/llm/client';
import { asRecord, asString, asStringArray } from '@/lib/llm/validate';
import { JOB_PARSE_SYSTEM, ROLE_MATCH_SYSTEM } from '@/lib/llm/prompts';
import { listRoleProfiles } from '@/lib/roles';
import { createJobPosting } from '@/lib/roles/roleFactory';
import { getStore } from '@/lib/store/memoryStore';
import type { JobPosting, RoleProfile, RoleRecommendation, RoleTarget } from '@/lib/types';

function hit(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

function starsFor(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

function quoteFor(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  const keyword = keywords.find((item) => lower.includes(item.toLowerCase()));
  if (!keyword) return '简历中未找到可引用的原文证据';
  const index = lower.indexOf(keyword.toLowerCase());
  const start = Math.max(0, index - 36);
  const end = Math.min(text.length, index + keyword.length + 64);
  return `「${text.slice(start, end).replace(/\s+/g, ' ').trim()}」`;
}

function reasonFor(role: RoleProfile, matched: string[], gaps: string[]): string {
  if (!matched.length) return `当前简历尚未呈现「${role.name}」的关键技能证据，建议先补充一个相关项目或实践。`;
  if (!gaps.length) return `简历覆盖了「${role.name}」的主要技能要求，可以优先进入岗位专项面试训练。`;
  return `简历已覆盖${matched.slice(0, 2).join('、')}，但仍缺少${gaps.slice(0, 2).join('、')}等要求，适合作为重点补强方向。`;
}

export async function recommendRoles(resumeText: string): Promise<RoleRecommendation[]> {
  const ruleResults = listRoleProfiles().map((role) => {
    const required = role.requirements.requiredSkills.filter((s) => hit(resumeText, s.keywords));
    const preferred = role.requirements.preferredSkills.filter((s) => hit(resumeText, s.keywords));
    const gaps = role.requirements.requiredSkills.filter((s) => !hit(resumeText, s.keywords));
    const score = Math.min(100, Math.round(
      (required.length / Math.max(1, role.requirements.requiredSkills.length)) * 70 +
      (role.requirements.preferredSkills.length ? preferred.length / role.requirements.preferredSkills.length : 0) * 20 +
      (resumeText.length >= 120 ? 10 : 4),
    ));
    const recommendation: RoleRecommendation['recommendation'] = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    const matchedSkills = [...required, ...preferred].map((s) => s.label);
    const gapLabels = gaps.slice(0, 4).map((s) => s.label);
    const skillEvidence = [...required, ...preferred].slice(0, 5).map((s) => ({
      skill: s.label,
      quote: quoteFor(resumeText, s.keywords),
    }));
    const gapDetails = gaps.slice(0, 4).map((s) => ({
      skill: s.label,
      why: '岗位要求中出现，但简历中没有找到明确使用证据。',
      nextStep: `补充「${s.label}」在项目中的具体使用场景、个人职责和结果。`,
    }));
    return {
      role,
      ruleScore: score,
      score,
      stars: starsFor(score),
      recommendation,
      matchedSkills,
      gaps: gapLabels,
      evidence: skillEvidence.map((item) => `${item.skill}：${item.quote}`),
      reason: reasonFor(role, matchedSkills, gapLabels),
      skillEvidence,
      gapDetails,
    };
  });

  const llm = await chatJSON<{ matches: {
    roleId: string;
    score: number;
    matchedSkills: string[];
    gaps: string[];
    evidence: string[];
    reason: string;
    skillEvidence: { skill: string; quote: string }[];
    gapDetails: { skill: string; why: string; nextStep: string }[];
  }[] }>({
    system: ROLE_MATCH_SYSTEM,
    user: [
      `【候选人简历】\n${resumeText.slice(0, 6000)}`,
      '【岗位摘要】',
      ...ruleResults.map((x) => `${x.role.id}｜${x.role.name}｜必备：${x.role.requirements.requiredSkills.map((s) => s.label).join('、')}｜职责：${x.role.requirements.responsibilities.slice(0, 3).join('、')}`),
      '请按系统提示返回所有岗位的匹配结果。',
    ].join('\n'),
    temperature: 0.1,
    timeoutMs: 20_000,
    validate: (raw) => {
      const r = asRecord(raw);
      if (!r || !Array.isArray(r.matches)) return null;
      const matches = r.matches.map((item) => {
        const m = asRecord(item);
        if (!m || !asString(m.roleId)) return null;
        const n = Number(m.score);
        if (!Number.isFinite(n)) return null;
        return {
          roleId: asString(m.roleId),
          score: Math.max(0, Math.min(100, Math.round(n))),
          matchedSkills: asStringArray(m.matchedSkills, 8),
          gaps: asStringArray(m.gaps, 6),
          evidence: asStringArray(m.evidence, 4),
          reason: asString(m.reason),
          skillEvidence: Array.isArray(m.skillEvidence) ? m.skillEvidence.map((x) => {
            const item = asRecord(x);
            return item ? { skill: asString(item.skill), quote: asString(item.quote) } : null;
          }).filter((x): x is { skill: string; quote: string } => Boolean(x?.skill && x.quote)).slice(0, 6) : [],
          gapDetails: Array.isArray(m.gapDetails) ? m.gapDetails.map((x) => {
            const item = asRecord(x);
            return item ? { skill: asString(item.skill), why: asString(item.why), nextStep: asString(item.nextStep) } : null;
          }).filter((x): x is { skill: string; why: string; nextStep: string } => Boolean(x?.skill)).slice(0, 6) : [],
        };
      }).filter((m): m is NonNullable<typeof m> => m !== null);
      return matches.length ? { matches } : null;
    },
  });

  const byId = new Map((llm?.matches ?? []).map((m) => [m.roleId, m]));
  const recommendations = ruleResults.map(({ ruleScore, ...base }) => {
    const semantic = byId.get(base.role.id);
    if (!semantic) return base;
    const score = Math.round(ruleScore * 0.6 + semantic.score * 0.4);
    const recommendation: RoleRecommendation['recommendation'] = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    const matchedSkills = semantic.matchedSkills.length ? semantic.matchedSkills : base.matchedSkills;
    const gaps = semantic.gaps.length ? semantic.gaps : base.gaps;
    const skillEvidence = semantic.skillEvidence.length ? semantic.skillEvidence : base.skillEvidence;
    const gapDetails = semantic.gapDetails.length ? semantic.gapDetails : base.gapDetails;
    return {
      ...base,
      score,
      stars: starsFor(score),
      recommendation,
      matchedSkills,
      gaps,
      evidence: semantic.evidence.length ? semantic.evidence : base.evidence,
      reason: semantic.reason || reasonFor(base.role, matchedSkills, gaps),
      skillEvidence,
      gapDetails,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
  const now = new Date().toISOString();
  await getStore().saveRecommendation({
    id: randomUUID(),
    resumeText,
    recommendations,
    createdAt: now,
  }, recommendations.map((recommendation) => ({
      id: randomUUID(),
      referenceId: recommendation.role.id,
      context: 'recommendation' as const,
      roleId: recommendation.role.id,
      role: recommendation.role,
      createdAt: now,
    })));
  return recommendations;
}

export interface ParsedJob {
  title: string;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
}

function parseList(text: string, markers: string[]): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim().replace(/^[-*•\d.、\s]+/, '');
    if (!line) continue;
    const heading = /^(?:工作内容|工作职责|岗位职责|职责|任职要求|岗位要求|技能要求|加分项?|优先条件|responsibilities|requirements|qualifications|preferred(?: requirements| qualifications| skills)?|nice[- ]to[- ]have|bonus|what you['’]ll (?:do|bring)|about (?:the team|us))[:：]?$/i.test(line);
    if (heading) {
      inSection = markers.some((m) => line.toLowerCase().includes(m.toLowerCase()));
      continue;
    }
    if (inSection || markers.some((m) => line.toLowerCase().includes(m.toLowerCase()))) {
      if (line.length >= 2) out.push(line.slice(0, 200));
    }
  }
  return [...new Set(out)].slice(0, 12);
}

function fallbackJob(text: string): ParsedJob {
  const lines = text.split(/\n+/).map((x) => x.trim().replace(/^[-*•\d.、\s]+/, '')).filter(Boolean);
  const title = lines.find((x) => x.length <= 120 && /工程师|开发|分析|测试|产品|运营|engineer|developer|analyst|designer|manager/i.test(x))?.slice(0, 80) || '自定义岗位';
  const known = ['Python', 'Java', 'JavaScript', 'TypeScript', 'Ruby', 'Rails', 'React', 'Vue', 'SQL', 'MySQL', 'PostgreSQL', 'Redis', 'Docker', 'Linux', 'Spring', 'FastAPI', 'Flask', 'Django', 'REST', 'GraphQL', 'RSpec', 'LLM', 'RAG', 'GitLab', 'CI/CD', 'prompt engineering', 'Excel', 'Pandas', '机器学习', '测试', '自动化'];
  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const hasRequirementsSection = lines.some((line) => /^(?:任职要求|岗位要求|技能要求|requirements|qualifications|what you['’]ll bring)[:：]?$/i.test(line));
  let section: 'required' | 'preferred' | 'other' = hasRequirementsSection ? 'other' : 'required';
  for (const line of lines) {
    if (line === title || line.startsWith(title) && title !== '自定义岗位') continue;
    if (/^(?:加分项?|优先条件|preferred(?: requirements| qualifications| skills)?|nice[- ]to[- ]have|bonus)[:：]?$/i.test(line)) { section = 'preferred'; continue; }
    if (/^(?:任职要求|岗位要求|技能要求|requirements|qualifications|what you['’]ll bring)[:：]?$/i.test(line)) { section = 'required'; continue; }
    if (/^(?:工作内容|工作职责|岗位职责|职责|responsibilities|what you['’]ll do|about (?:the team|us)|benefits)[:：]?$/i.test(line)) { section = 'other'; continue; }
    const optional = section === 'preferred' || /加分|优先|\b(?:preferred|bonus|plus|nice[- ]to[- ]have|optional)\b/i.test(line);
    if (section === 'other' && !optional) continue;
    const matched = known.filter((skill) => /^[a-z]/i.test(skill)
      ? new RegExp('(^|[^a-zA-Z0-9_])' + skill + '(?=$|[^a-zA-Z0-9_])', 'i').test(line)
      : line.includes(skill));
    if (!matched.length) continue;
    const target = optional ? preferredSkills : requiredSkills;
    const language = 'Python|Java|JavaScript|TypeScript|Ruby';
    const englishChoice = line.match(/\bat least one\b[^()\n]*\(([^)]+)\)/i);
    const chineseChoice = line.match(new RegExp('^(?:熟悉|掌握)?\\s*((?:' + language + ')(?:\\s*(?:或|/)\\s*(?:' + language + '))+)\\s*(?:至少一种|任选一种|之一)[。.]?$', 'i'));
    const choice = englishChoice ?? chineseChoice;
    if (choice) {
      const options = known.filter((skill) => new RegExp('^(?:' + language + ')$', 'i').test(skill)
        && new RegExp('(^|[^a-zA-Z0-9_])' + skill + '(?=$|[^a-zA-Z0-9_])', 'i').test(choice[1]));
      if (options.length >= 2) {
        target.push(`${options.join(' / ')}（至少一种）`);
        const outside = line.replace(choice[0], '');
        target.push(...matched.filter((skill) => new RegExp('(^|[^a-zA-Z0-9_])' + skill + '(?=$|[^a-zA-Z0-9_])', 'i').test(outside)));
        continue;
      }
    }
    // Keep alternatives together: splitting an OR statement invents mandatory requirements.
    if (matched.length > 1 && /\bor\b|\bat least one\b|任选|至少一种|或|之一/i.test(line)) target.push(line.slice(0, 200));
    else target.push(...matched);
  }
  return {
    title,
    description: lines.slice(0, 4).join(' ').slice(0, 300),
    responsibilities: parseList(text, ['负责', '参与', '工作内容', '职责', 'responsibilities', "what you'll do", 'what you’ll do']),
    requiredSkills: requiredSkills.length ? [...new Set(requiredSkills)].slice(0, 15) : ['岗位核心技能（请根据原文确认）'],
    preferredSkills: [...new Set(preferredSkills)].slice(0, 10),
  };
}

export async function importJobPosting(text: string, options: { preview?: boolean; confirmed?: ParsedJob; provenance?: unknown; collectionReceipt?: unknown } = {}): Promise<JobPosting> {
  const normalizedText = options.collectionReceipt ? text : text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  const provenance = resolveJobProvenance(text, options.provenance, options.collectionReceipt);
  const fallback = fallbackJob(normalizedText);
  const parsed = options.confirmed ?? await chatJSON<ParsedJob>({
    system: JOB_PARSE_SYSTEM,
    user: `请解析以下招聘描述，只使用其中明确出现的信息：\n${normalizedText.slice(0, 12000)}`,
    temperature: 0.1,
    timeoutMs: 20_000,
    validate: (raw) => {
      const r = asRecord(raw);
      if (!r || !asString(r.title)) return null;
      return {
        title: asString(r.title).split(/\r?\n|工作职责|岗位职责|任职要求/)[0].trim().slice(0, 80),
        description: asString(r.description).slice(0, 500),
        responsibilities: asStringArray(r.responsibilities, 12),
        requiredSkills: asStringArray(r.requiredSkills, 15),
        preferredSkills: asStringArray(r.preferredSkills, 10),
      };
    },
  });
  const parsedJob = parsed ?? fallback;
  const toSkills = (labels: string[]) => labels.map((label) => ({
    label,
    keywords: /^(?:Python|Java|JavaScript|TypeScript|Ruby)(?: \/ (?:Python|Java|JavaScript|TypeScript|Ruby))+（至少一种）$/.test(label)
      ? label.replace('（至少一种）', '').split(' / ')
      : [label],
  }));
  const job = createJobPosting({
    id: `custom-${randomUUID()}`,
    name: parsedJob.title,
    description: parsedJob.description || '用户导入的招聘岗位描述',
    responsibilities: parsedJob.responsibilities,
    requiredSkills: toSkills(parsedJob.requiredSkills),
    preferredSkills: toSkills(parsedJob.preferredSkills),
    commonProjectTypes: ['与该岗位描述相关的项目'],
    isMock: false,
    rawDescription: normalizedText,
    source: 'user_jd',
    sourceUrl: provenance.sourceUrl,
    company: provenance.company,
  });
  job.provenance = { ...provenance, contentHash: jobContentHash(normalizedText), requirementsReview: options.confirmed ? 'user_confirmed' : 'automatic' };
  if (!options.preview) await getStore().saveJobPosting(job);
  return job;
}

/** 从数据库恢复用户导入的岗位，供岗位列表和直接 API 调用使用。 */
export async function listAvailableRoles(): Promise<RoleTarget[]> {
  const persisted = await getStore().listJobPostings();
  return [...listRoleProfiles(), ...persisted];
}

/** 获取静态职业方向或持久化的具体岗位。 */
export async function getTargetRole(id: string): Promise<RoleTarget | null> {
  const local = listRoleProfiles().find((role) => role.id === id);
  if (local) return local;
  const persisted = await getStore().getJobPosting(id);
  return persisted;
}
