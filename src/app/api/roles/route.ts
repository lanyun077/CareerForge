import { withUser } from '@/lib/auth';
import { ok } from '@/lib/api';
import { listAvailableRoles } from '@/lib/services/roleService';

export const dynamic = 'force-dynamic';

async function handleGET() {
  return ok(await listAvailableRoles());
}

export const GET = withUser(handleGET);
