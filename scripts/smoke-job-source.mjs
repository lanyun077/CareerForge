import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3310';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
async function api(path, body, status = 200) {
  const res = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const result = await res.json(); assert.equal(res.status, status, result.message); return result.data;
}
const jobText = 'Python工程师\n负责API开发与数据库查询优化，要求Python、SQL、Git项目经验。';
const input = { jobText, provenance: { sourceUrl: 'https://example.com/careers/fixture', company: '虚构验收公司', method: 'manual' } };
const preview = await api('/api/roles/import', { ...input, preview: true });
assert(!(await api('/api/roles')).some((r) => r.id === preview.id));
const job = await api('/api/roles/import', input);
assert.equal(job.provenance.method, 'manual');
assert.equal(job.provenance.availability, 'unknown');
assert.equal((await api('/api/roles')).find((r) => r.id === job.id).provenance.contentHash, job.provenance.contentHash);
await api('/api/roles/import', { ...input, provenance: { ...input.provenance, method: 'greenhouse_api' } }, 422);
await api('/api/roles/collect', { url: 'http://127.0.0.1/admin' }, 422);
await api('/api/roles/collect', { url: 'https://boards.greenhouse.io.evil.com/example/jobs/123' }, 422);
const analysis = await api('/api/resume/analyze', { roleId: job.id, resumeText: '虚构验收简历：熟悉Python和SQL，负责课程项目的接口开发、Git协作与数据库索引优化，编写十二条单元测试并使用Docker部署验证。' });
let session = await api('/api/interview/start', { roleId: job.id, resumeAnalysisId: analysis.id, settings: { questionCount: 5, difficulty: 'standard', maxFollowUps: 0 } });
assert.deepEqual(session.roleSnapshot.provenance, job.provenance);
for (let i = 0; session.status === 'active' && i < 10; i++) {
  session = (await api('/api/interview/answer', { sessionId: session.id, questionId: session.questions.at(-1).id, answer: '我负责Python接口，使用SQL分析查询，通过单元测试验证修改效果。' })).session;
}
assert.equal(session.status, 'completed');
assert.deepEqual((await api('/api/report/' + session.id)).jobProvenance, job.provenance);
console.log('✓ 来源预览不保存、确认保存、伪造采集拒绝、训练快照与报告来源闭环通过');
