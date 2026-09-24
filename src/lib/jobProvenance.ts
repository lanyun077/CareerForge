import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ServiceError } from '@/lib/api';
import type { JobProvenance } from '@/lib/types';

// Receipts are short-lived and process-local. A restart requires collecting again.
const runtime = globalThis as typeof globalThis & { careerForgeReceiptKey?: Buffer };
const receiptKey = runtime.careerForgeReceiptKey ??= randomBytes(32);
export const jobContentHash = (text: string) => createHash('sha256').update(text).digest('hex');

export function issueCollectionReceipt(text: string, provenance: JobProvenance): string {
  const payload = Buffer.from(JSON.stringify({ provenance: { ...provenance, contentHash: jobContentHash(text) }, expires: Date.now() + 30 * 60_000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', receiptKey).update(payload).digest('base64url')}`;
}

export function resolveJobProvenance(text: string, raw?: unknown, receipt?: unknown): JobProvenance {
  if (receipt !== undefined && receipt !== '') {
    if (typeof receipt !== 'string' || receipt.length > 8000) throw new ServiceError('采集凭据无效，请重新采集', 422);
    const [payload, signature, extra] = receipt.split('.');
    const expected = createHmac('sha256', receiptKey).update(payload || '').digest();
    const supplied = Buffer.from(signature || '', 'base64url');
    if (extra || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ServiceError('采集凭据无效，请重新采集', 422);
    let parsed: { provenance: JobProvenance; expires: number };
    try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
    catch { throw new ServiceError('采集凭据无效，请重新采集', 422); }
    if (parsed.expires < Date.now() || parsed.provenance.contentHash !== jobContentHash(text)) throw new ServiceError('采集凭据已过期或正文已修改，请重新采集或按手工描述导入', 422);
    return parsed.provenance;
  }
  if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) throw new ServiceError('岗位来源格式无效', 422);
  const input = (raw ?? {}) as Record<string, unknown>;
  if (input.method && input.method !== 'manual') throw new ServiceError('接口采集来源需要有效采集凭据', 422);
  let sourceUrl: string | undefined;
  if (input.sourceUrl !== undefined && input.sourceUrl !== '') {
    if (typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 2000) throw new ServiceError('来源链接无效', 422);
    let url: URL;
    try { url = new URL(input.sourceUrl); } catch { throw new ServiceError('来源链接无效', 422); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new ServiceError('来源链接必须是无账号密码的 HTTP(S) 链接', 422);
    url.hash = '';
    sourceUrl = url.toString();
  }
  if (input.company !== undefined && typeof input.company !== 'string') throw new ServiceError('公司名称格式无效', 422);
  return { sourceUrl, company: typeof input.company === 'string' ? input.company.trim().slice(0, 120) || undefined : undefined, method: 'manual', collectedAt: new Date().toISOString(), contentHash: jobContentHash(text), availability: 'unknown' };
}
