import { ok } from '@/lib/api';
import { listRoles } from '@/lib/roles';

export async function GET() {
  return ok(listRoles());
}
