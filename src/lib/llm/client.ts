/**
 * 大模型客户端：统一封装 OpenAI-compatible API
 *
 * 设计原则（对应方案 六、稳定性与降级方案）：
 * - 未配置 OPENAI_API_KEY 时返回 null，调用方使用固定题库 / 规则兜底
 * - 调用失败自动重试一次，仍失败返回 null，不允许页面崩溃
 * - 输出必须是 JSON，并经过调用方传入的校验函数验证
 */

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getLLMConfig(): LLMConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

export function isLLMConfigured(): boolean {
  return getLLMConfig() !== null;
}

export interface ChatJSONParams<T> {
  system: string;
  user: string;
  /** 校验并归一化模型输出；返回 null 表示校验失败（触发重试 / 兜底） */
  validate: (raw: unknown) => T | null;
  temperature?: number;
  timeoutMs?: number;
}

/** 从模型返回文本中尽力提取 JSON（容忍代码块包裹、前后多余文本） */
export function extractJSON(text: string): unknown | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const startArr = t.indexOf('[');
  const from = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (from === -1) return null;
  const endObj = t.lastIndexOf('}');
  const endArr = t.lastIndexOf(']');
  const to = Math.max(endObj, endArr);
  if (to <= from) return null;
  try {
    return JSON.parse(t.slice(from, to + 1));
  } catch {
    return null;
  }
}

/**
 * 调用 chat/completions 并解析 JSON。
 * 成功返回校验后的数据；未配置 / 失败 / 校验不通过（重试一次后）返回 null。
 */
export async function chatJSON<T>(params: ChatJSONParams<T>): Promise<T | null> {
  const cfg = getLLMConfig();
  if (!cfg) return null;

  const messages = [
    { role: 'system', content: params.system },
    { role: 'user', content: params.user },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: params.temperature ?? 0.3,
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (!content) continue;
      const parsed = extractJSON(content);
      if (parsed === null) continue;
      const validated = params.validate(parsed);
      if (validated !== null) return validated;
    } catch {
      // 网络异常 / 超时：重试一次
    }
  }
  return null;
}
