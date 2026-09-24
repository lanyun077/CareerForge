import { NextResponse } from 'next/server';
import { authConfig, authEnabled, boundedRequest, checkOrigin, cookieToken, limitRequests, verifyUser } from '@/lib/auth';
import { fail, ok, ServiceError } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!authEnabled()) return ok({ enabled: false, signedIn: false });
  try { await verifyUser(cookieToken(req)); return ok({ enabled: true, signedIn: true }); }
  catch (error) { return error instanceof ServiceError && error.status === 401 ? ok({ enabled: true, signedIn: false }) : fail('登录服务暂时不可用', 503); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (!authEnabled()) return fail('当前为本地演示模式，无需登录', 409);
    limitRequests('login', 20);
    const { email, password } = await (await boundedRequest(req, 4096)).json();
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || !password || password.length > 1024) return fail('请输入有效的邮箱与密码', 422);
    const { url, key } = authConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!response.ok) return fail('登录失败，请检查邮箱与密码，或稍后重试', response.status >= 500 ? 503 : 401);
    const data = await response.json();
    if (typeof data.access_token !== 'string') return fail('登录服务响应异常', 503);
    const result = NextResponse.json({ ok: true, data: { signedIn: true } });
    const hostname = new URL(`${new URL(req.url).protocol}//${req.headers.get('host') ?? new URL(req.url).host}`).hostname;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    result.cookies.set('cf-access', data.access_token, { httpOnly: true, secure: !local || new URL(req.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: Math.min(Number(data.expires_in) || 3600, 3600) });
    return result;
  } catch (error) { return fail(error instanceof ServiceError ? error.message : '登录服务暂时不可用', error instanceof ServiceError ? error.status : 503); }
}
export async function DELETE(req: Request) {
  try { checkOrigin(req); } catch { return fail('请求来源不允许', 403); }
  const result = NextResponse.json({ ok: true, data: { signedIn: false } });
  result.cookies.set('cf-access', '', { httpOnly: true, path: '/', maxAge: 0 });
  return result;
}
