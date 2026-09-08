import { ok } from '@/lib/api';
import { isLLMConfigured, getLLMConfig } from '@/lib/llm/client';
import { isAsrConfigured } from '@/lib/services/asrService';

/** 系统运行状态：当前为“在线模型”还是“题库兜底”模式 */
export async function GET() {
  const cfg = getLLMConfig();
  return ok({
    mode: isLLMConfigured() ? 'llm' : 'fallback',
    llmModel: cfg?.model ?? null,
    store: 'memory',
    asrConfigured: isAsrConfigured(),
  });
}
