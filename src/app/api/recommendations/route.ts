import { withUser } from '@/lib/auth';
import { ok } from '@/lib/api';
import { getStore } from '@/lib/store/memoryStore';
export const GET = withUser(async () => ok((await getStore().listRecommendations()).map(({ resumeText, ...record }) => record)));
export const DELETE = withUser(async () => { await getStore().clearRecommendations(); return ok({ deleted: true }); });
