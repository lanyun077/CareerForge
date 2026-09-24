import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3210';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
async function request(path, body) {
  const response = await fetch(base + path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, ...await response.json() };
}
const health = await request('/api/health');
assert(health.data.store === 'memory', 'Use an isolated memory test server');
const analysis = await request('/api/resume/analyze', { roleId: 'python-backend-intern', resumeText: '虚构简历：熟悉 Python Flask MySQL Git，负责订单系统后端开发，设计十二张表和二十三个接口，通过索引优化查询并完成自动化测试。' });
const started = await request('/api/interview/start', { roleId: 'python-backend-intern', resumeAnalysisId: analysis.data.id });
let session = started.data;
const sessionId = session.id;
const target = (s) => {
  const q = s.questions.at(-1);
  return q.answer === undefined ? q.id : q.followUps.at(-1).id;
};
const payload = { sessionId, questionId: target(session), answer: '我做了一些接口。' };
try {
  const first = await request('/api/interview/answer', payload);
  assert(first.ok);
  const retry = await request('/api/interview/answer', payload);
  assert(retry.ok);
  assert.deepEqual(retry.data.session.questions, first.data.session.questions, 'Retry must not answer the follow-up or advance');
  console.log('✓ 同一主回答重试不推进');
  assert.equal((await request('/api/interview/answer', { ...payload, answer: '旧页面的不同回答' })).status, 409);
  console.log('✓ 旧页面不同回答被拒绝');
  assert.equal((await request('/api/interview/answer', { sessionId, answer: '缺少问题标识' })).status, 422);
  console.log('✓ 缺少问题标识被拒绝');
  session = retry.data.session;
  const concurrent = { sessionId, questionId: target(session), answer: '我负责接口和数据库的实现。' };
  const pair = await Promise.all([request('/api/interview/answer', concurrent), request('/api/interview/answer', concurrent)]);
  assert(pair.every((r) => r.ok));
  assert.deepEqual(pair[0].data.session.questions, pair[1].data.session.questions);
  session = (await request(`/api/interview/session/${sessionId}`)).data;
  assert.equal(session.currentPlanIndex, 1);
  console.log('✓ 并发相同追问回答只推进一次');
  const conflictId = target(session);
  const conflicts = await Promise.all(['回答 A', '回答 B'].map((answer) => request('/api/interview/answer', { sessionId, questionId: conflictId, answer })));
  assert.equal(conflicts.filter((r) => r.ok).length, 1);
  assert.equal(conflicts.filter((r) => r.status === 409).length, 1);
  console.log('✓ 并发不同回答只有一个成功');
  session = (await request(`/api/interview/session/${sessionId}`)).data;
  let last;
  for (let i = 0; session.status === 'active' && i < 20; i++) {
    last = { sessionId, questionId: target(session), answer: '我负责 12 个接口，用 pytest 验证。' };
    const result = await request('/api/interview/answer', last);
    assert(result.ok);
    session = result.data.session;
  }
  assert.equal(session.status, 'completed');
  assert.equal((await request('/api/interview/answer', last)).data.session.status, 'completed');
  assert.equal((await request('/api/interview/answer', { ...last, questionId: 'unknown' })).status, 409);
  assert.equal((await request('/api/interview/answer', payload)).data.session.status, 'completed');
  console.log('✓ 完成后重试已接收回答安全，未知问题被拒绝');
} finally {
  await fetch(`${base}/api/records?id=${sessionId}`, { method: 'DELETE' });
}
