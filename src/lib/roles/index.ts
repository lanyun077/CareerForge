import type { JobPosting, RoleProfile, RoleTarget } from '@/lib/types';
import { pythonBackendIntern } from './pythonBackendIntern';
import { roleCatalog } from './catalog';
import { specialistQuestions } from './specialistQuestions';

const profiles: RoleProfile[] = [pythonBackendIntern, ...roleCatalog].map((role) => ({
  ...role, questionBank: [...role.questionBank, ...(specialistQuestions[role.id] ?? [])],
}));
const globalState = globalThis as unknown as { __careerForgeJobPostings?: Map<string, JobPosting> };
const jobPostings = globalState.__careerForgeJobPostings ??= new Map<string, JobPosting>();

export function listRoleProfiles(): RoleProfile[] {
  return profiles;
}

export function listRoles(): RoleTarget[] {
  return [...profiles, ...jobPostings.values()];
}

export function getRole(id: string): RoleTarget | null {
  return profiles.find((r) => r.id === id) ?? jobPostings.get(id) ?? null;
}

export function registerJobPosting(job: JobPosting): JobPosting {
  jobPostings.set(job.id, job);
  return job;
}

/** 兼容旧服务调用；具体岗位应使用 registerJobPosting。 */
export function addRole(role: RoleTarget): RoleTarget {
  if (role.kind === 'job_posting') return registerJobPosting(role);
  const index = profiles.findIndex((item) => item.id === role.id);
  if (index >= 0) profiles[index] = role;
  return role;
}
