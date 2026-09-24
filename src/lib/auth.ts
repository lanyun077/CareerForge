import { AsyncLocalStorage } from 'node:async_hooks';
import { NextResponse } from 'next/server';
import { fail, ServiceError } from './api';

const context = new AsyncLocalStorage<string>();
export const authEnabled = () => process.env.AUTH_MODE === 'supabase' || (process.env.NODE_ENV === 'production' && process.env.AUTH_MODE !== 'local-demo');
export function currentOwner(): string {
  const owner = context.getStore();
  if (owner) return owner;
  if (authEnabled()) throw new ServiceError('请先登录', 401);
  return 'local-demo';
}
export function authConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new ServiceError('登录服务尚未配置', 503);
  return { url: url.replace(/\/+$/, ''), key };
}
export function cookieToken(req: Request): string {
  return req.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith('cf-access='))?.slice(10) ?? '';
}
export async function verifyUser(token: string): Promise<string> {
  if (!token) throw new ServiceError('请先登录', 401);
  const { url, key } = authConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch { throw new ServiceError('登录服务暂时不可用，请重试', 503); }
  if (response.status === 401 || response.status === 403) throw new ServiceError('登录已过期，请重新登录', 401);
  if (!response.ok) throw new ServiceError('登录服务暂时不可用，请重试', 503);
  const user = await response.json();
  if (typeof user.id !== 'string' || !user.id) throw new ServiceError('登录验证失败', 401);
  return user.id;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  // Next.js 可将 req.url 的主机规范化为 localhost；Host 保留浏览器实际访问的站点。
  const target = new URL(req.url);
  const expected = `${target.protocol}//${req.headers.get('host') ?? target.host}`;
  if (origin !== expected) throw new ServiceError('请求来源不允许', 403);
}
export async function boundedRequest(req: Request, maxBytes: number): Promise<Request> {
  if (!req.body) return req;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new ServiceError('请求内容过大', 413); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return new Request(req.url, { method: req.method, headers: req.headers, body });
}

const requests = new Map<string, { count: number; until: number }>();
export function limitRequests(key: string, max = 60) {
  const now = Date.now();
  for (const [id, value] of requests) if (value.until <= now) requests.delete(id);
  const entry = requests.get(key) ?? { count: 0, until: now + 60_000 };
  if (entry.count >= max || (!requests.has(key) && requests.size >= 10_000)) throw new ServiceError('请求较多，请稍后重试', 429);
  entry.count++;
  requests.set(key, entry);
}

/** 所有业务 Route Handler 的身份入口；用户 ID 只来自认证服务。 */
export function withUser<C>(handler: (req: Request, params: C) => Promise<Response>) {
  return async (req: Request, params: C): Promise<Response> => {
    try {
      if (req.method !== 'GET') checkOrigin(req);
      const length = Number(req.headers.get('content-length') ?? 0);
      const limit = req.headers.get('content-type')?.includes('multipart/form-data') ? 16 * 1024 * 1024 : 128 * 1024;
      if (length > limit) return fail('请求内容过大', 413);
      const owner = authEnabled() ? await verifyUser(cookieToken(req)) : 'local-demo';
      if (authEnabled()) limitRequests(owner);
      const bounded = await boundedRequest(req, limit);
      const response = await context.run(owner, () => handler(bounded, params));
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch (error) {
      if (error instanceof ServiceError) return fail(error.message, error.status);
      return NextResponse.json({ ok: false, message: '服务暂时不可用，请重试' }, { status: 503 });
    }
  };
}
