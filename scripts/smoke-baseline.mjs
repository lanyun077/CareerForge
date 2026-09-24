// 仅对隔离的本地规则 / 内存服务运行；不会调用真实模型。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:3210';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only local test servers are allowed');
let passed = 0;
function check(name, condition) {
  assert(condition, name);
  console.log(`✓ ${name}`);
  passed++;
}
async function api(path, body) {
  const response = await fetch(`${base}${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  assert(result.ok, `${path}: ${result.message}`);
  return result.data;
}
async function upload(blob, name) {
  const form = new FormData();
  if (blob) form.append('file', blob, name);
  const response = await fetch(`${base}/api/resume/parse-pdf`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
}
async function complete(session) {
  for (let i = 0; i < 20; i++) {
    const q = session.questions.at(-1);
    const questionId = q.answer === undefined ? q.id : q.followUps.at(-1).id;
    const result = await api('/api/interview/answer', { sessionId: session.id, questionId, answer: '我负责 Python Flask 接口和 MySQL 数据库，设计了十二张表，通过索引将查询从 800ms 降到 120ms，并用 pytest 验证。' });
    session = result.session;
    if (result.event === 'completed') return result.session;
  }
  throw new Error('Interview did not complete');
}

const health = await api('/api/health');
assert(health.mode === 'fallback' && health.store === 'memory', 'Use an isolated fallback/memory server');
const roles = await api('/api/roles');
check('内置 13 个职业方向', roles.filter((role) => role.kind === 'role_profile').length === 13);
const resumeText = '虚构测试简历：计算机专业，熟悉 Python、Flask、MySQL、Git、pytest。负责订单管理系统后端，设计十二张数据表，实现二十三个接口，优化索引将响应时间由 800ms 降至 120ms。';
const matches = await api('/api/roles/recommend', { resumeText });
check('推荐 5 项且按分数降序', matches.length === 5 && matches.every((item, i) => i === 0 || matches[i - 1].score >= item.score));
check('推荐包含原文证据与缺口', matches.every((item) => Array.isArray(item.skillEvidence) && Array.isArray(item.gapDetails)));
const job = await api('/api/roles/import', { jobText: 'Python 后端开发实习生\n负责订单接口开发和数据库优化。\n要求掌握 Python、Flask、MySQL、Git，了解 pytest 自动化测试。' });
const preview = await api('/api/roles/import', { jobText: '前端开发实习生，负责 React 与 TypeScript 页面开发，使用 Git 协作，了解自动化测试。', preview: true });
check('JD 预览不提前保存', !(await api('/api/roles')).some((role) => role.id === preview.id));
check('JD 导入后列表可读取', (await api('/api/roles')).some((role) => role.id === job.id));
const analysis = await api('/api/resume/analyze', { roleId: job.id, resumeText });
check('简历分析保存 JD 快照', analysis.roleSnapshot?.id === job.id);
const first = await api('/api/interview/start', { roleId: job.id, resumeAnalysisId: analysis.id });
check('面试保存岗位快照与 7 题计划', first.roleSnapshot?.id === job.id && first.plan.length === 7);
check('会话接口恢复当前问题', (await api(`/api/interview/session/${first.id}`)).questions[0].id === first.questions[0].id);
await complete(first);
check('JD 首轮报告可生成', (await api(`/api/report/${first.id}`)).dimensionScores.length === 5);
const second = await api('/api/interview/start', { roleId: job.id, round: 2, basedOnSessionId: first.id });
await complete(second);
check('JD 二轮报告包含对比', (await api(`/api/report/${second.id}`)).comparison.dimensionDeltas.length === 5);
check('挑战题数由程序说明', (await api(`/api/report/${first.id}`)).nextChallenge.description.includes(`共 ${second.plan.length} 道主问题`));
for (const path of ['/', '/resume', '/records', `/interview?sessionId=${first.id}`, `/report/${first.id}`]) {
  check(`页面 HTTP 可访问：${path.split('?')[0]}`, (await fetch(`${base}${path}`)).status === 200);
}
const pdf = await upload(new Blob([readFileSync('test-data/sample-compressed.pdf')], { type: 'application/pdf' }), 'sample.pdf');
check('文本 PDF 正确提取', pdf.body.ok && pdf.body.data.source === 'text' && pdf.body.data.text.includes('Python Flask MySQL'));
check('缺文件返回 422', (await upload()).status === 422);
check('错误类型返回 415', (await upload(new Blob(['text'], { type: 'text/plain' }), 'resume.txt')).status === 415);
check('损坏 PDF 返回 422', (await upload(new Blob(['invalid'], { type: 'application/pdf' }), 'broken.pdf')).status === 422);
check('空 PDF 返回 422', (await upload(new Blob([], { type: 'application/pdf' }), 'empty.pdf')).status === 422);
check('超大 PDF 返回 413', (await upload(new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'large.pdf')).status === 413);
const analyzeForm = new FormData();
analyzeForm.append('roleId', job.id);
analyzeForm.append('file', new Blob([readFileSync('test-data/sample-compressed.pdf')], { type: 'application/pdf' }), 'sample.pdf');
check('旧 multipart 分析入口复用 PDF 解析', (await (await fetch(`${base}/api/resume/analyze`, { method: 'POST', body: analyzeForm })).json()).ok);
for (const id of [second.id, first.id]) {
  const response = await fetch(`${base}/api/records?id=${id}`, { method: 'DELETE' });
  assert((await response.json()).ok);
}
console.log(`结果：${passed} 通过；推荐与 JD 测试数据随内存服务退出清空。`);
