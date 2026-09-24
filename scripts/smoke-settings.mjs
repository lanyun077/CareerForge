import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3310';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
async function api(path, body) {
  const response = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const result = await response.json(); assert(result.ok, result.message); return result.data;
}
const role = (await api('/api/roles'))[0];
const analysis = await api('/api/resume/analyze', { roleId: role.id, resumeText: '虚构测试简历：熟悉Python Flask MySQL Git，负责订单系统后端，设计十二张表，优化索引，将响应从800ms降至120ms，使用pytest测试。' });
for (const maxFollowUps of [0, 2]) {
  const settings = { questionCount: 5, difficulty: 'advanced', maxFollowUps };
  let session = await api('/api/interview/start', { roleId: role.id, resumeAnalysisId: analysis.id, settings });
  assert.equal(session.plan.length, 5);
  assert.deepEqual((await api('/api/interview/session/' + session.id)).settings, settings);
  for (let i = 0; session.status === 'active' && i < 20; i++) {
    const q = session.questions.at(-1);
    const questionId = q.answer === undefined ? q.id : q.followUps.at(-1).id;
    session = (await api('/api/interview/answer', { sessionId: session.id, questionId, answer: `我负责模块，暂时记不清第${i}项的细节。` })).session;
  }
  assert.equal(session.status, 'completed');
  assert(session.questions.every((q) => q.followUps.length <= maxFollowUps));
  if (maxFollowUps === 2) assert(session.questions.some((q) => q.followUps.length === 2));
  const report = await api('/api/report/' + session.id);
  assert(report.nextChallenge.description.includes(`最多 ${maxFollowUps} 次`));
  const second = await api('/api/interview/start', { roleId: role.id, round: 2, basedOnSessionId: session.id });
  assert.deepEqual(second.settings, settings);
  assert.equal(second.plan.length, 5);
}
const invalid = await fetch(base + '/api/interview/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: role.id, resumeAnalysisId: analysis.id, settings: { maxFollowUps: 20 } }) });
assert.equal(invalid.status, 422);
console.log('✓ 自定义题数/难度、0或2次追问完整闭环、二轮继承和非法配置检查通过');
