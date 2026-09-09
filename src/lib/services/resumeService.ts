/**
 * 简历解析与分析服务（方案 3.2）
 *
 * 双通道：大模型抽取 + 岗位匹配；模型未配置 / 调用失败 / 输出不合规时，
 * 使用规则兜底（关键词匹配 + 空泛表述检测），保证分析结果始终结构化。
 */

import { randomUUID } from 'crypto';
import type { ExtractedProject, ResumeAnalysis, ResumeGap, Role } from '@/lib/types';
import { chatJSON } from '@/lib/llm/client';
import { RESUME_ANALYSIS_SYSTEM } from '@/lib/llm/prompts';
import { validateResumeAnalysis } from '@/lib/llm/validate';
import { getStore } from '@/lib/store/memoryStore';

type AnalysisCore = Omit<ResumeAnalysis, 'source' | 'createdAt' | 'id' | 'roleId' | 'resumeText'>;

const TECH_KEYWORDS = [
  'python', 'flask', 'fastapi', 'django', 'mysql', 'postgresql', 'sqlite', 'redis',
  'docker', 'linux', 'git', 'nginx', 'celery', 'kafka', 'rabbitmq', 'asyncio',
  'pytest', 'html', 'css', 'javascript', 'vue', 'react',
];

export async function analyzeResume(role: Role, resumeText: string): Promise<ResumeAnalysis> {
  const ruleBase = ruleAnalyze(role, resumeText);

  const llmResult = await chatJSON<AnalysisCore>({
    system: RESUME_ANALYSIS_SYSTEM,
    user: buildResumeUserPrompt(role, resumeText),
    temperature: 0.2,
    validate: (raw) =>
      validateResumeAnalysis(raw, role, {
        extractedFields: ruleBase.extractedFields,
        matchingScore: ruleBase.matchingScore,
        matchedSkills: ruleBase.matchedSkills,
        gaps: ruleBase.gaps,
        vagueIssues: ruleBase.vagueIssues,
        suggestions: ruleBase.suggestions,
      }),
  });

  const analysis: ResumeAnalysis = {
    id: randomUUID(),
    roleId: role.id,
    resumeText,
    ...(llmResult ?? ruleBase),
    source: llmResult ? 'llm' : 'rule',
    createdAt: new Date().toISOString(),
  };
  await getStore().saveResumeAnalysis(analysis);
  return analysis;
}

// ---------- 大模型提示 ----------

function buildResumeUserPrompt(role: Role, resumeText: string): string {
  const skills = [
    ...role.requirements.requiredSkills.map((s) => `必备：${s.label}`),
    ...role.requirements.preferredSkills.map((s) => `加分：${s.label}`),
  ].join('\n');
  return `【岗位要求】\n${skills}\n\n【候选人简历全文】\n${resumeText.slice(0, 6000)}\n\n请按系统提示的 JSON 格式输出分析结果。`;
}

// ---------- 规则兜底分析 ----------

function ruleAnalyze(role: Role, resumeText: string): AnalysisCore {
  const lower = resumeText.toLowerCase();
  const hit = (keywords: string[]) => keywords.some((k) => lower.includes(k.toLowerCase()));

  const matchedReq = role.requirements.requiredSkills.filter((s) => hit(s.keywords));
  const matchedPref = role.requirements.preferredSkills.filter((s) => hit(s.keywords));
  const gapSkills = role.requirements.requiredSkills.filter((s) => !hit(s.keywords));

  const gaps: ResumeGap[] = gapSkills.slice(0, 4).map((s) => ({
    requirement: s.label,
    current: '简历中未找到该技能的相关描述',
    problem: '岗位必备技能缺少证据，简历筛选和面试追问时都难以通过',
    suggestion: `在项目经历或技能清单中补充「${s.label}」的实际使用场景：做了什么、怎么用的、效果如何`,
    evidence: '',
  }));

  const projects = extractProjects(resumeText);
  const vagueIssues = detectVague(resumeText, projects);

  const reqRatio = matchedReq.length / Math.max(1, role.requirements.requiredSkills.length);
  const prefRatio = matchedPref.length / Math.max(1, role.requirements.preferredSkills.length);
  const matchingScore = Math.round(reqRatio * 60 + prefRatio * 25 + (projects.length ? 15 : 0));

  return {
    extractedFields: {
      education: extractEducation(resumeText),
      skills: [...matchedReq, ...matchedPref].map((s) => s.label),
      projects,
      achievements: [],
    },
    matchingScore,
    matchedSkills: [...matchedReq, ...matchedPref].map((s) => s.label),
    gaps,
    vagueIssues,
    suggestions: buildSuggestions(gapSkills, vagueIssues, role),
  };
}

function extractEducation(text: string): string {
  const m = text.match(/[^\n]*(大学|学院|学校)[^\n]*(专业)[^\n]*/);
  return m ? m[0].trim().slice(0, 60) : '';
}

function extractProjects(text: string): ExtractedProject[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const projects: ExtractedProject[] = [];
  for (const line of lines) {
    if (!/(项目|系统|平台|工具|小程序|网站|服务|应用)/.test(line)) continue;
    if (line.length < 10 || line.length > 200) continue;
    if (/^(技能|技术栈|专业技能|skill)/i.test(line)) continue;
    const lower = line.toLowerCase();
    const stack = TECH_KEYWORDS.filter((k) => lower.includes(k));
    const m = line.match(/^([^：:]{2,24})[：:]/);
    const name = m ? m[1] : line.slice(0, 14);
    projects.push({ name, description: line, stack, results: '' });
    if (projects.length >= 5) break;
  }
  return projects;
}

function detectVague(text: string, projects: ExtractedProject[]): string[] {
  const issues: string[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/(负责|参与|完成)了?[^。；\n]{0,20}(相关工作|开发工作|部分工作|基本功能)/.test(line)) {
      issues.push(`空泛表述：「${line.slice(0, 40)}${line.length > 40 ? '…' : ''}」——没有说明具体负责的模块、实现方法和产出`);
    }
    if (issues.length >= 4) break;
  }
  for (const p of projects) {
    if (!/\d/.test(p.description)) {
      issues.push(`缺少量化结果：项目「${p.name}」没有数据规模、性能指标或用户量等可验证的结果`);
    }
  }
  return issues.slice(0, 5);
}

function buildSuggestions(
  gapSkills: Role['requirements']['requiredSkills'],
  vagueIssues: string[],
  role: Role,
): ResumeAnalysis['suggestions'] {
  const out: ResumeAnalysis['suggestions'] = [];
  if (gapSkills.length) {
    out.push({
      priority: 1,
      title: `补齐必备技能「${gapSkills[0].label}」的证据`,
      detail: `岗位要求中「${gapSkills[0].label}」是必备项。把它写进项目经历：在哪个项目里用了它、解决了什么问题、效果如何。`,
    });
  }
  if (vagueIssues.some((v) => v.includes('量化'))) {
    out.push({
      priority: Math.min(3, out.length + 1) as 1 | 2 | 3,
      title: '为项目补充量化结果',
      detail: '每个项目至少写 2 个可验证的数字：数据规模（表数量、日请求量）、性能变化（响应时间、QPS）、覆盖范围（用户数、测试覆盖率）。',
    });
  }
  out.push({
    priority: Math.min(3, out.length + 1) as 1 | 2 | 3,
    title: '让项目经历对准目标岗位',
    detail: `围绕该岗位常见项目类型（如${role.requirements.commonProjectTypes[0]}），突出与后端开发直接相关的职责：接口设计、数据库设计、服务优化。`,
  });
  return out.slice(0, 3);
}
