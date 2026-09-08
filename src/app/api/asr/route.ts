import { fail, ok } from '@/lib/api';
import { AsrNotConfiguredError, isAsrConfigured, transcribeAudio } from '@/lib/services/asrService';

export const runtime = 'nodejs';

/**
 * 语音转写（可选能力）。未配置时返回 501，前端降级为文字输入；
 * 转写失败返回 502，同样提示改用文字输入（方案 6.4 / 七）。
 */
export async function GET() {
  return ok({ configured: isAsrConfigured() });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('缺少音频文件', 422, 'no_audio');
    const text = await transcribeAudio(file);
    if (!text) return fail('未识别到有效语音内容，请改用文字输入', 422, 'empty_transcript');
    return ok({ text });
  } catch (err) {
    if (err instanceof AsrNotConfiguredError) return fail(err.message, 501, 'asr_not_configured');
    console.error('[asr] failed:', err);
    return fail('语音转写失败，请改用文字输入', 502, 'asr_failed');
  }
}
