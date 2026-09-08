import { fail, ok } from '@/lib/api';
import { extractTextFromPdf } from '@/lib/parser/pdf';
import { getRole } from '@/lib/roles';
import { analyzeResume } from '@/lib/services/resumeService';

export const runtime = 'nodejs';

const MIN_TEXT = 50;
const MAX_TEXT = 20_000;

/**
 * 简历分析：支持 JSON（粘贴文本）与 multipart（PDF 上传）两种输入。
 * PDF 解析失败时返回 code=pdf_parse_failed，前端引导用户粘贴文本（方案 6.4）。
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let roleId = '';
    let resumeText = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      roleId = String(form.get('roleId') ?? '');
      const file = form.get('file');
      if (file instanceof File) {
        try {
          const { text } = await extractTextFromPdf(await file.arrayBuffer());
          resumeText = text;
        } catch {
          return fail(
            'PDF 解析失败：请确认上传的是文本型 PDF，或直接粘贴简历文本（推荐）。',
            422,
            'pdf_parse_failed',
          );
        }
      }
    } else {
      const body = (await req.json()) as { roleId?: string; resumeText?: string };
      roleId = body.roleId ?? '';
      resumeText = (body.resumeText ?? '').trim();
    }

    const role = getRole(roleId);
    if (!role) return fail('岗位不存在', 404);
    if (resumeText.length < MIN_TEXT) {
      return fail(`简历文本过短（至少 ${MIN_TEXT} 字），请粘贴完整简历内容`, 422, 'resume_too_short');
    }
    resumeText = resumeText.slice(0, MAX_TEXT);

    const analysis = await analyzeResume(role, resumeText);
    return ok(analysis);
  } catch (err) {
    console.error('[resume/analyze] failed:', err);
    return fail('简历分析失败，请重试；若反复失败请直接粘贴简历文本', 500, 'analyze_failed');
  }
}
