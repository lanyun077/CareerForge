/**
 * 语音转写服务（方案 七）
 *
 * 独立封装的可选能力：浏览器录音 → 上传音频 → ASR 转文字 → 进入原有文字面试流程。
 * 未配置 ASR_API_KEY 时明确返回“未配置”，由前端降级为文字输入；
 * 转写失败同样降级为文字输入，不阻塞主流程。
 */

export class AsrNotConfiguredError extends Error {
  constructor() {
    super('语音转写为可选能力：请配置 ASR_API_KEY 后启用，当前请使用文字输入。');
  }
}

interface AsrConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function isAsrConfigured(): boolean {
  return Boolean(process.env.ASR_API_KEY?.trim());
}

function getAsrConfig(): AsrConfig | null {
  const apiKey = process.env.ASR_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    baseUrl: (process.env.ASR_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.ASR_MODEL || 'whisper-1',
  };
}

/** 转写音频文件为文字（OpenAI-compatible /audio/transcriptions） */
export async function transcribeAudio(file: File): Promise<string> {
  const cfg = getAsrConfig();
  if (!cfg) throw new AsrNotConfiguredError();

  const form = new FormData();
  form.append('file', file, file.name || 'audio.webm');
  form.append('model', cfg.model);

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error('语音转写失败，请改用文字输入');
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
