import type { InterviewSettings, RoleTarget } from './types';
import { ServiceError } from './api';

export const DEFAULT_INTERVIEW_SETTINGS: InterviewSettings = { questionCount: 7, difficulty: 'standard', maxFollowUps: 1 };
export function parseInterviewSettings(value: unknown): InterviewSettings {
  if (value === undefined) return { ...DEFAULT_INTERVIEW_SETTINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ServiceError('面试配置无效', 422);
  const settings = { ...DEFAULT_INTERVIEW_SETTINGS, ...value };
  if (![5, 7, 9].includes(settings.questionCount) || !['basic', 'standard', 'advanced'].includes(settings.difficulty) || ![0, 1, 2].includes(settings.maxFollowUps)) throw new ServiceError('面试配置超出允许范围', 422);
  return { questionCount: settings.questionCount, difficulty: settings.difficulty, maxFollowUps: settings.maxFollowUps };
}

export function configureInterviewRole(role: RoleTarget, settings: InterviewSettings): RoleTarget {
  const questionBank = [...role.questionBank];
  if (settings.questionCount === 9) {
    const skill = role.requirements.requiredSkills[0]?.label ?? role.name;
    questionBank.push(
      { id: 'extended-tech', stage: 'tech', text: `围绕「${skill}」，描述一次排查错误的过程：如何复现、缩小范围并验证修复？`, tags: ['技术', '原理'] },
      { id: 'extended-scenario', stage: 'scenario', text: `在「${role.name}」任务中，需求临时变化而交付时间不变，你如何划分优先级并验证关键结果？`, tags: ['场景', '岗位相关'] },
    );
  }
  const stages = role.interviewStages.map((stage) => ({ ...stage }));
  let total = stages.reduce((sum, stage) => sum + stage.questionCount, 0);
  while (total !== settings.questionCount) {
    const stage = total < settings.questionCount
      ? ['tech', 'scenario', 'project'].map((id) => stages.find((s) => s.id === id)).find((s) => s && questionBank.filter((q) => q.stage === s.id).length > s.questionCount)
      : [...stages].reverse().find((s) => s.id !== 'wrap' && s.questionCount > (s.id === 'behavior' ? 0 : 1));
    if (!stage) throw new ServiceError('该岗位题库暂不支持所选题数', 422);
    stage.questionCount += total < settings.questionCount ? 1 : -1;
    total += total < settings.questionCount ? 1 : -1;
  }
  return { ...role, interviewStages: stages.filter((s) => s.questionCount > 0), questionBank: questionBank.map((q) => ({ ...q, text: q.stage === 'wrap' || settings.difficulty === 'standard' ? q.text : `${q.text}\n${settings.difficulty === 'basic' ? '先说明基本概念，再用一个简单例子解释。' : '请比较至少两种方案，说明适用边界、失败场景与验证方法。'}` })) };
}
