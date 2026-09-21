import type { BankQuestion, InterviewStage, JobPosting, RoleProfile, ScoringDimension } from '@/lib/types';

const STAGES: InterviewStage[] = [
  { id: 'self-intro', name: '自我介绍', questionCount: 1 },
  { id: 'project', name: '项目经历', questionCount: 2 },
  { id: 'tech', name: '技术问题', questionCount: 1 },
  { id: 'scenario', name: '场景问题', questionCount: 1 },
  { id: 'behavior', name: '行为问题', questionCount: 1 },
  { id: 'wrap', name: '总结', questionCount: 1 },
];

const RUBRIC: ScoringDimension[] = [
  { id: 'structure', name: '表达结构', weight: 0.25, focus: '是否有清晰的背景、任务、行动和结果（STAR）', maxScore: 5 },
  { id: 'specificity', name: '回答具体性', weight: 0.25, focus: '是否包含具体职责、方法、数据和结果', maxScore: 5 },
  { id: 'relevance', name: '岗位相关性', weight: 0.2, focus: '是否回答了目标岗位真正关心的能力', maxScore: 5 },
  { id: 'evidence', name: '项目证据', weight: 0.2, focus: '是否能证明用户确实参与并理解项目', maxScore: 5 },
  { id: 'tech', name: '技术完整度', weight: 0.1, focus: '技术概念、原理和方案是否基本完整', maxScore: 5 },
];

function bank(title: string, skills: string[]): BankQuestion[] {
  const focus = skills.slice(0, 3).join('、') || '岗位核心技能';
  return [
    { id: `${title}-intro`, stage: 'self-intro', text: `请用 1 分钟介绍你的背景、技术栈，以及为什么选择${title}。`, tags: ['结构', '总结'] },
    { id: `${title}-project-1`, stage: 'project', text: `介绍一个最能体现你适合${title}的项目：背景、职责、方案和结果是什么？`, tags: ['项目', 'STAR', '结果'] },
    { id: `${title}-project-2`, stage: 'project', text: '项目中遇到过什么难题？你如何定位、解决并验证效果？', tags: ['项目', '细节', '量化'] },
    { id: `${title}-tech`, stage: 'tech', text: `结合项目讲讲${focus}中的一个核心原理、使用场景和边界。`, tags: ['技术', '原理'] },
    { id: `${title}-scenario`, stage: 'scenario', text: `如果${title}负责的系统或业务出现异常，你会如何排查、沟通并验证修复？`, tags: ['场景', '岗位相关'] },
    { id: `${title}-behavior`, stage: 'behavior', text: '讲一次你和团队成员出现分歧的经历，以及最后如何达成一致。', tags: ['STAR', '结构'] },
    { id: `${title}-wrap`, stage: 'wrap', text: '总结一下你今天最有信心的部分，以及最需要提升的能力。', tags: ['总结', '结构'] },
  ];
}

export interface RoleFactoryInput {
  id: string;
  name: string;
  description: string;
  requiredSkills: { label: string; keywords: string[] }[];
  category?: string;
  aliases?: string[];
  preferredSkills?: { label: string; keywords: string[] }[];
  responsibilities?: string[];
  commonProjectTypes?: string[];
  isMock?: boolean;
  mockNotice?: string;
}

export function createRoleProfile(input: RoleFactoryInput): RoleProfile {
  return {
    kind: 'role_profile',
    id: input.id,
    name: input.name,
    category: input.category ?? '软件工程',
    aliases: input.aliases ?? [],
    description: input.description,
    isMock: input.isMock ?? false,
    mockNotice: input.mockNotice ?? '岗位信息来自用户提供的招聘描述，请以原招聘页面为准。',
    requirements: {
      responsibilities: input.responsibilities?.length ? input.responsibilities : [`完成${input.name}相关工作并协作交付`],
      requiredSkills: input.requiredSkills,
      preferredSkills: input.preferredSkills ?? [],
      commonProjectTypes: input.commonProjectTypes?.length ? input.commonProjectTypes : ['与岗位职责相关的业务项目'],
    },
    interviewStages: STAGES,
    scoringRubric: RUBRIC,
    questionBank: bank(input.name, input.requiredSkills.map((s) => s.label)),
  };
}

/** 兼容旧目录文件的工厂名；新代码使用 createRoleProfile。 */
export const createRole = createRoleProfile;

export function createJobPosting(
  input: RoleFactoryInput & Pick<JobPosting, 'rawDescription'> & Partial<Pick<JobPosting, 'source' | 'sourceUrl' | 'company' | 'location' | 'salary' | 'experienceLevel' | 'publishedAt' | 'expiresAt'>>,
): JobPosting {
  const profile = createRoleProfile(input);
  return {
    ...profile,
    kind: 'job_posting',
    source: input.source ?? 'user_jd',
    rawDescription: input.rawDescription,
    sourceUrl: input.sourceUrl,
    company: input.company,
    location: input.location,
    salary: input.salary,
    experienceLevel: input.experienceLevel,
    publishedAt: input.publishedAt,
    fetchedAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
  };
}
