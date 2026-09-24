import assert from 'node:assert/strict';
import http from 'node:http';
const base = process.argv[2] || 'http://127.0.0.1:3213';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
async function api(path, cookie, body, method = body ? 'POST' : 'GET') {
  const res = await fetch(base + path, { method, headers: { origin: new URL(base).origin, ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, cookie: res.headers.get('set-cookie'), ...await res.json() };
}
assert.equal((await api('/api/health')).data.authentication, 'supabase');
assert.equal((await api('/api/health')).data.store, 'memory', 'Use isolated memory instance');
for (const route of ['/api/records', '/api/roles', '/api/recommendations', '/api/report/test', '/api/interview/session/test']) assert.equal((await api(route)).status, 401);
assert.equal((await api('/api/records', 'cf-access=forged')).status, 401);
console.log('✓ 未登录和伪造身份均被拒绝');
const login = await api('/api/auth', null, { email: 'alice@test.invalid', password: 'test-only-password' });
assert(login.ok && login.cookie.includes('HttpOnly') && login.cookie.includes('SameSite=lax'));
const publicLogin = await new Promise((resolve, reject) => {
  const req = http.request(base + '/api/auth', { method: 'POST', headers: { host: 'trial.example.test', origin: 'http://trial.example.test', 'Content-Type': 'application/json' } }, (res) => {
    res.resume(); res.on('end', () => resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.join(';') ?? '' }));
  });
  req.on('error', reject);
  req.end(JSON.stringify({ email: 'alice@test.invalid', password: 'test-only-password' }));
});
assert.equal(publicLogin.status, 200);
assert(publicLogin.cookie.includes('Secure'), 'Public host cookies must be Secure even when Next normalizes the request URL');
const alice = login.cookie.split(';')[0];
const bob = (await api('/api/auth', null, { email: 'bob@test.invalid', password: 'test-only-password' })).cookie.split(';')[0];
const text = '虚构简历：熟悉 Python Flask MySQL Git，负责订单系统后端开发，设计十二张表和二十三个接口，通过索引优化查询并完成自动化测试。';
const job = (await api('/api/roles/import', alice, { jobText: 'Python 开发实习生，负责 Flask 接口设计和 MySQL 数据库优化，熟悉 Git 和 Python 测试。' })).data;
assert(!(await api('/api/roles', bob)).data.some((r) => r.id === job.id));
assert.equal((await api('/api/resume/analyze', bob, { roleId: job.id, resumeText: text })).status, 404);
console.log('✓ 导入 JD 不跨用户泄漏');
const analysis = (await api('/api/resume/analyze', alice, { roleId: job.id, resumeText: text })).data;
let session = (await api('/api/interview/start', alice, { roleId: job.id, resumeAnalysisId: analysis.id })).data;
const id = session.id;
assert.equal((await api('/api/interview/start', bob, { roleId: job.id, resumeAnalysisId: analysis.id })).status, 404);
assert.equal((await api(`/api/interview/session/${id}`, bob)).status, 404);
assert.equal((await api('/api/interview/answer', bob, { sessionId: id, questionId: session.questions[0].id, answer: '越权回答' })).status, 404);
assert.equal((await api(`/api/records?id=${id}`, bob, undefined, 'DELETE')).status, 404);
assert.equal((await api('/api/records', bob)).data.length, 0);
console.log('✓ 跨用户读取、回答、删除、列表和简历引用被隔离');
for (let i = 0; session.status === 'active' && i < 20; i++) {
  const q = session.questions.at(-1);
  const result = await api('/api/interview/answer', alice, { sessionId: id, questionId: q.answer === undefined ? q.id : q.followUps.at(-1).id, answer: '我负责 Python 接口，实现了 12 个测试。' });
  assert(result.ok); session = result.data.session;
}
assert.equal(session.status, 'completed');
assert((await api(`/api/report/${id}`, alice)).ok);
assert.equal((await api(`/api/report/${id}`, bob)).status, 404);
assert.equal((await api('/api/interview/start', bob, { roleId: job.id, round: 2, basedOnSessionId: id })).status, 404);
await api('/api/roles/recommend', alice, { resumeText: text });
assert.equal((await api('/api/recommendations', bob)).data.length, 0);
assert((await api('/api/recommendations', alice)).data.length > 0);
assert((await api('/api/recommendations', alice, undefined, 'DELETE')).ok);
assert.equal((await api('/api/recommendations', alice)).data.length, 0);
assert((await api('/api/roles', alice)).data.some((r) => r.id === job.id));
assert((await api(`/api/records?id=${id}`, alice, undefined, 'DELETE')).ok);
assert.equal((await api(`/api/report/${id}`, alice)).status, 404);
console.log('✓ 报告隔离、推荐清空、保留 JD 与训练删除通过');
const csrf = await fetch(base + '/api/interview/start', { method: 'POST', headers: { cookie: alice, origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(csrf.status, 403);
assert((await api('/api/auth', alice, undefined, 'DELETE')).cookie.includes('Max-Age=0'));
console.log('✓ 跨站写请求被拒绝，退出清除会话 Cookie');
