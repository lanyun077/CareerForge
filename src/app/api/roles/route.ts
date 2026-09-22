import { ok } from '@/lib/api';
import { listAvailableRoles } from '@/lib/services/roleService';

export const dynamic = 'force-dynamic';

export async function GET() {
  return ok(await listAvailableRoles());
}
