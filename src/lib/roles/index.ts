import type { Role } from '@/lib/types';
import { pythonBackendIntern } from './pythonBackendIntern';

const roles: Role[] = [pythonBackendIntern];

export function listRoles(): Role[] {
  return roles;
}

export function getRole(id: string): Role | null {
  return roles.find((r) => r.id === id) ?? null;
}
