import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { createHash } from 'node:crypto';
import { ServiceError } from '@/lib/api';
import { currentOwner, limitRequests } from '@/lib/auth';
import { issueCollectionReceipt } from '@/lib/jobProvenance';

const API_HOST = 'boards-api.greenhouse.io';
const MAX_BYTES = 512 * 1024;
let active = 0;

export function parseCollectionUrl(input: unknown) {
  if (typeof input !== 'string' || input.length > 2048) throw new ServiceError('请填写 Greenhouse 公开岗位链接', 422);
  let url: URL;
  try { url = new URL(input); } catch { throw new ServiceError('岗位链接格式错误', 422); }
  const match = /^\/([a-zA-Z0-9_-]{1,100})\/jobs\/(\d{1,20})\/?$/.exec(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) || !match) {
    throw new ServiceError('目前仅支持 Greenhouse 的公开岗位详情链接', 422);
  }
  const [, board, id] = match;
  return { board, id, sourceUrl: `https://job-boards.greenhouse.io/${board}/jobs/${id}` };
}

// 仅使用公开 IPv4；固定 API 域名且将审核过的地址绑定到 TLS 连接，避免二次 DNS 解析。
export function isPublicAddress(address: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  const [a, b, c, d] = address.split('.').map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[name.toLowerCase()] ?? entity;
  });
}

function redactContacts(text: string) {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已省略]')
    .replace(/((?:联系电话|联系电话号码|电话|手机|phone|telephone|tel|call)\s*[:：]?\s*)(\+?\d[\d ()-]{7,}\d)/gi, '$1[联系电话已省略]')
    .replace(/\+\d[\d ()-]{8,}\d/g, '[联系电话已省略]')
    .replace(/\b1[3-9]\d{9}\b/g, '[联系电话已省略]');
}

export function postingCompany(payload: unknown): string | undefined {
  const company = (payload as { company_name?: unknown } | null)?.company_name;
  if (typeof company !== 'string') return undefined;
  return redactContacts(decodeEntities(decodeEntities(company)).replace(/<[^>]*>/g, '').trim()).slice(0, 120) || undefined;
}

export function postingText(payload: unknown, expectedId: string) {
  const job = payload as { id?: unknown; title?: unknown; content?: unknown; location?: { name?: unknown } } | null;
  if (!job || String(job.id) !== expectedId || typeof job.title !== 'string' || typeof job.content !== 'string') throw new ServiceError('岗位数据格式不符合预期', 502);
  const plain = decodeEntities(decodeEntities(job.content))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '\n');
  const title = job.title.replace(/<[^>]*>/g, '');
  const text = redactContacts(`${title}\n${typeof job.location?.name === 'string' ? job.location.name.replace(/<[^>]*>/g, '') : ''}\n${plain}`)
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  if (text.length < 30) throw new ServiceError('岗位正文过短，请手动核对来源', 422);
  if (text.length > 12_000) throw new ServiceError('岗位正文过长，请手动粘贴与训练相关的内容', 422);
  return text;
}

async function readPosting(board: string, id: string) {
  const signal = AbortSignal.timeout(10_000);
  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const abort = () => reject(new ServiceError('岗位数据源响应超时', 504));
    signal.addEventListener('abort', abort, { once: true });
    lookup(API_HOST, { family: 4, all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) throw new ServiceError('岗位数据源地址不允许访问', 502);
  const address = addresses[0].address;
  return new Promise<unknown>((resolve, reject) => {
    const req = request({
      hostname: API_HOST, servername: API_HOST, port: 443, method: 'GET', agent: false, family: 4,
      path: `/v1/boards/${board}/jobs/${id}?content=true`, signal,
      headers: { Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'CareerForge/0.1 (job-preview)' },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, (response) => {
      response.on('error', reject);
      response.once('aborted', () => reject(new ServiceError('岗位数据传输中断，请重试', 502)));
      const fail = (message: string, status = 502) => { response.destroy(); reject(new ServiceError(message, status)); };
      if (response.statusCode === 404) return fail('岗位已下架或链接不存在，请核对来源', 404);
      if (response.statusCode !== 200) return fail('岗位数据源暂不可用，不跟随重定向');
      if (!response.headers['content-type']?.includes('application/json') || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) return fail('岗位数据源返回了不支持的格式');
      if (Number(response.headers['content-length'] ?? 0) > MAX_BYTES) return fail('岗位数据响应过大');
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { fail('岗位数据响应过大'); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new ServiceError('岗位数据源返回了无效数据', 502)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function collectJobPosting(input: unknown) {
  const { board, id, sourceUrl } = parseCollectionUrl(input);
  limitRequests(`job-collection:${currentOwner()}`, 6);
  limitRequests('job-collection:global', 30);
  if (active >= 3) throw new ServiceError('岗位采集繁忙，请稍后重试', 429);
  active++;
  try {
    const payload = await readPosting(board, id);
    const jobText = postingText(payload, id);
    const provenance = { sourceUrl, company: postingCompany(payload), collectedAt: new Date().toISOString(), method: 'greenhouse_api' as const, contentHash: createHash('sha256').update(jobText).digest('hex'), availability: 'unknown' as const };
    return { jobText, provenance, collectionReceipt: issueCollectionReceipt(jobText, provenance) };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('岗位采集失败，请稍后重试或手动粘贴 JD', 502);
  } finally { active--; }
}
