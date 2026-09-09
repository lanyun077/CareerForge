import { ok } from '@/lib/api';
import { isLLMConfigured, getLLMConfig } from '@/lib/llm/client';
import { isAsrConfigured } from '@/lib/services/asrService';
import { getStore } from '@/lib/store/memoryStore';

/** 系统运行状态：模型模式 + 存储后端（必须动态，反映运行时配置） */
export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getLLMConfig();
  return ok({
    mode: isLLMConfigured() ? 'llm' : 'fallback',
    llmModel: cfg?.model ?? null,
    store: getStore().kind,
    asrConfigured: isAsrConfigured(),
  });
}
