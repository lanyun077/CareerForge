// 使用项目已有 TypeScript 编译器加载服务，测试不连接真实模型或数据库。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const resolved = path.resolve(file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const mod = { exports: {} };
  cache.set(resolved, mod);
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (id) => {
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id);
    let target = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(resolved), id);
    target = fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts');
    return load(target);
  };
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}
process.env.OPENAI_API_KEY = ' ';
process.env.DATABASE_URL = ' ';

async function main() {
  const { selectFromBank } = load('src/lib/services/interviewService.ts');
  const { listRoleProfiles } = load('src/lib/roles/index.ts');
  const normalize = (s) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  for (const role of listRoleProfiles()) {
    const first = selectFromBank(role, { round: 1, focusWeaknesses: [], previousQuestions: [] });
    const previousQuestions = first.map((q) => '  ' + q.text + '\n');
    const second = selectFromBank(role, { round: 2, focusWeaknesses: ['项目证据'], previousQuestions });
    assert.equal(second.length, first.length);
    for (const stage of role.interviewStages) {
      const previous = new Set(first.map((q) => normalize(q.text)));
      const fresh = new Set(role.questionBank.filter((q) => q.stage === stage.id && !previous.has(normalize(q.text))).map((q) => normalize(q.text)));
      const selected = second.filter((q) => q.stageId === stage.id);
      assert.equal(selected.filter((q) => fresh.has(normalize(q.text))).length, Math.min(fresh.size, selected.length));
    }
  }
  console.log('✓ 13 个岗位二轮优先未问题，候选不足仍保留题数');
  const { scoreQuestion } = load('src/lib/services/scoringService.ts');
  const role = listRoleProfiles()[0];
  const { parseInterviewSettings, configureInterviewRole } = load('src/lib/interviewSettings.ts');
  for (const questionCount of [5, 7, 9]) for (const candidate of listRoleProfiles()) {
    const configured = configureInterviewRole(candidate, { questionCount, difficulty: 'advanced', maxFollowUps: 2 });
    const plan = selectFromBank(configured, { round: 1, focusWeaknesses: [], previousQuestions: [] });
    assert.equal(plan.length, questionCount);
    assert(plan.filter((q) => q.stageId !== 'wrap').every((q) => q.text.includes('失败场景')));
  }
  for (const invalid of [null, [], { questionCount: 100 }, { difficulty: 'unknown' }, { maxFollowUps: 3 }]) assert.throws(() => parseInterviewSettings(invalid), (e) => e.status === 422);
  console.log('✓ 13岗位自定义题数与进阶要求，非法配置拒绝');
  const question = { id: 'q', stageId: 'tech', text: '测试问题', source: 'bank', tags: [], answer: '不知道', followUps: [] };
  const before = await scoreQuestion(role, null, question);
  const after = await scoreQuestion(role, null, { ...question, followUps: [{ id: 'f', text: '负责设计 Python Flask MySQL 方案，最终优化 100 个接口，因为索引原理提升性能。'.repeat(5), source: 'rule', reason: '测试', answer: '不知道' }] });
  assert.deepEqual(after.map((d) => d.score), before.map((d) => d.score), 'Interviewer wording must not inflate candidate scores');
  console.log('✓ 追问文字不能抬高用户评分');
  const clarified = { ...question, answer: '我做过接口。', followUps: [{ id: 'clarify', text: '请说明具体职责和结果。', source: 'rule', reason: '测试', answer: '我负责 Python 接口，通过索引优化将响应时间降低到 120ms。' }] };
  const clarifiedScores = await scoreQuestion(role, null, clarified);
  assert(clarifiedScores.every((d) => d.evidence.includes('我做过接口。') && d.evidence.includes('120ms')), 'Rule evidence must include the follow-up answer used for scoring');
  assert(clarifiedScores.every((d) => d.evidenceQuestion.includes(clarified.followUps[0].text) && d.evidenceSourceId === undefined), 'Combined evidence must not claim a single answer source');
  const { getStore } = load('src/lib/store/memoryStore.ts');
  const { buildReport } = load('src/lib/services/reportService.ts');
  const reportStore = getStore();
  await reportStore.saveResumeAnalysis({ id: 'report-analysis', resumeText: '不应复制到报告的完整简历正文', matchingScore: 63, matchedSkills: ['Python'], gaps: [{ requirement: 'SQL', problem: '缺少证据', suggestion: '补充查询案例' }], source: 'rule' });
  await reportStore.saveSession({ id: 'resume-summary-report', resumeAnalysisId: 'report-analysis', roleId: role.id, roleSnapshot: role, round: 1, status: 'completed', questions: [{ ...clarified, dimensionScores: clarifiedScores }], plan: [] });
  const summaryReport = await buildReport('resume-summary-report');
  assert.equal(summaryReport.resumeSummary.matchingScore, 63);
  assert.equal(summaryReport.resumeSummary.gaps[0].requirement, 'SQL');
  assert.equal(summaryReport.resumeSummary.resumeText, undefined);
  console.log('✓ 报告保存当次简历匹配摘要，不复制简历正文');
  const reportSession = { id: 'evidence-report', resumeAnalysisId: 'none', roleId: role.id, roleSnapshot: role, round: 1, status: 'completed', questions: [{ ...clarified, dimensionScores: clarifiedScores }], plan: [] };
  await reportStore.saveSession(reportSession);
  const ruleReport = await buildReport(reportSession.id);
  assert(ruleReport.dimensionScores.every((d) => d.evidence.includes('120ms') && d.evidenceQuestion.includes('追问：')));
  const llmScores = clarifiedScores.map((d) => ({ ...d, source: 'llm', evidence: '「响应时间降低到 120ms」', evidenceSourceId: 'clarify', evidenceQuestion: undefined }));
  await reportStore.saveSession({ ...reportSession, id: 'followup-report', questions: [{ ...clarified, dimensionScores: llmScores }] });
  const followupReport = await buildReport('followup-report');
  assert(followupReport.dimensionScores.every((d) => d.evidenceQuestion === clarified.followUps[0].text), 'Follow-up evidence must display the follow-up question, not its parent');
  const client = load('src/lib/llm/client.ts');
  const originalChat = client.chatJSON;
  let releaseNarrative;
  let narrativeStarted;
  const started = new Promise((resolve) => { narrativeStarted = resolve; });
  client.chatJSON = async () => { narrativeStarted(); return new Promise((resolve) => { releaseNarrative = resolve; }); };
  try {
    await reportStore.saveSession({ ...reportSession, id: 'deleted-during-report' });
    const pending = buildReport('deleted-during-report');
    await started;
    await reportStore.deleteRecord('deleted-during-report');
    releaseNarrative(null);
    await assert.rejects(() => pending, (error) => error.status === 404);
    assert.equal(await reportStore.getReportBySession('deleted-during-report'), null);
  } finally { client.chatJSON = originalChat; }
  console.log('✓ 模型等待期间删除训练，延迟报告返回404且不会重建数据');
  console.log('✓ 规则报告保留主回答与追问证据，模型追问引用关联实际问题');
  let modelCalls = 0;
  client.chatJSON = async () => { modelCalls++; await new Promise((resolve) => setTimeout(resolve, 15)); return null; };
  try {
    await reportStore.saveSession({ ...reportSession, id: 'shared-report' });
    const reports = await Promise.all([buildReport('shared-report'), buildReport('shared-report')]);
    assert.equal(modelCalls, 1, 'Concurrent report requests must share model work');
    assert.equal(reports[0].id, reports[1].id);
    const { submitAnswer } = load('src/lib/services/interviewService.ts');
    await reportStore.saveSession({ ...reportSession, id: 'shared-answer', status: 'active', currentPlanIndex: 0, plan: [{ stageId: 'tech' }], questions: [{ ...question, answer: undefined }] });
    modelCalls = 0;
    const answers = await Promise.all([submitAnswer('shared-answer', '不知道', 'q'), submitAnswer('shared-answer', '不知道', 'q')]);
    assert.equal(modelCalls, 1, 'Concurrent identical answers must share follow-up generation');
    assert.equal(answers[0].session.questions[0].followUps[0].id, answers[1].session.questions[0].followUps[0].id);
  } finally { client.chatJSON = originalChat; }
  const { sharePending } = load('src/lib/services/pendingWork.ts');
  const ownerA = {}, ownerB = {};
  assert.deepEqual(await Promise.all([sharePending(ownerA, 'same', async () => 'A'), sharePending(ownerB, 'same', async () => 'B')]), ['A', 'B']);
  await assert.rejects(() => sharePending(ownerA, 'retry', async () => { throw new Error('Temporary failure'); }));
  assert.equal(await sharePending(ownerA, 'retry', async () => 'recovered'), 'recovered');
  console.log('✓ 相同回答和报告复用模型任务，用户隔离且失败后可重试');
  const originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'timeout-test';
  let fetchCalls = 0;
  const signals = [];
  global.fetch = async (_url, options) => {
    fetchCalls++; signals.push(options.signal);
    if (fetchCalls === 1) return { ok: false };
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert(options.signal.aborted);
    throw new Error('Timed out');
  };
  try {
    assert.equal(await client.chatJSON({ system: 'test', user: 'test', timeoutMs: 10, validate: (v) => v }), null);
    assert.equal(fetchCalls, 2);
    assert.equal(signals[0], signals[1], 'Retries must share the total timeout budget');
  } finally { global.fetch = originalFetch; process.env.OPENAI_API_KEY = ' '; }
  console.log('✓ 模型重试共用超时预算，超时后降级');
  const { transcribeAudio } = load('src/lib/services/asrService.ts');
  const audio = new File(['test audio'], 'answer.webm', { type: 'audio/webm' });
  process.env.ASR_API_KEY = 'test-asr';
  global.fetch = async (_url, options) => {
    assert.equal(options.body.get('file').name, 'answer.webm');
    return { ok: true, json: async () => ({ text: ' 我负责接口设计。 ' }) };
  };
  try {
    assert.equal(await transcribeAudio(audio), '我负责接口设计。');
    await assert.rejects(() => transcribeAudio(new File([], 'empty.webm', { type: 'audio/webm' })), (e) => e.status === 413);
    await assert.rejects(() => transcribeAudio(new File(['text'], 'bad.txt', { type: 'text/plain' })), (e) => e.status === 415);
    global.fetch = async () => ({ ok: true, json: async () => ({ text: 'a'.repeat(5001) }) });
    await assert.rejects(() => transcribeAudio(audio), (e) => e.status === 422);
  } finally { global.fetch = originalFetch; delete process.env.ASR_API_KEY; }
  console.log('✓ 语音转写协议、空录音、格式与过长转写校验通过');
  const { validateScoring, validateFollowUp, validateResumeAnalysis } = load('src/lib/llm/validate.ts');
  const resumeBase = { extractedFields: { education: '', skills: [], projects: [], achievements: [] }, matchingScore: 30, matchedSkills: [], gaps: [{ requirement: 'rule fallback' }], vagueIssues: [], suggestions: [] };
  const resumeGap = { requirement: 'Python', current: '项目描述', problem: '细节不足', suggestion: '补充测量方式', evidence: '「负责Python接口」' };
  assert.equal(validateResumeAnalysis({ gaps: [resumeGap] }, role, resumeBase, '我负责Python接口。').gaps[0].evidence, resumeGap.evidence);
  assert.deepEqual(validateResumeAnalysis({ gaps: [{ ...resumeGap, evidence: '「服务千万用户」' }] }, role, resumeBase, '我负责Python接口。').gaps, resumeBase.gaps);
  console.log('✓ 简历缺口引用校验，不存在的证据使用规则缺口');
  const sources = [{ id: 'answer-1', text: '我负责 Python 接口，通过索引将响应时间降低到 120ms。' }];
  const dimensions = role.scoringRubric.map((dim) => ({ name: dim.name, score: 3, evidence: '「我负责 Python 接口」', suggestion: '补充索引的选择与验证方法' }));
  assert(validateScoring({ dimensions }, role, sources).every((d) => d.evidenceSourceId === 'answer-1'));
  for (const patch of [{ score: 6 }, { score: -1 }, { score: Infinity }, { score: '3' }, { suggestion: '' }, { evidence: '「编造的千万用户量」' }]) {
    const invalid = dimensions.map((d, i) => i === 0 ? { ...d, ...patch } : d);
    assert.equal(validateScoring({ dimensions: invalid }, role, sources)[0], null);
  }
  assert.equal(validateScoring({ dimensions: dimensions.map((d) => ({ ...d, evidence: '不存在的证据' })) }, role, sources), null);
  assert.equal(validateFollowUp({ needFollowUp: true, text: '你提到「虚构成果」，如何验证？' }, sources), null);
  assert.equal(validateFollowUp({ text: '缺少布尔字段' }, sources), null);
  assert(validateFollowUp({ needFollowUp: true, text: '你提到「我负责 Python 接口」，如何验证？' }, sources));
  console.log('✓ 引用、来源、越界分数、空建议与逐维降级验证通过');
  const { getOcrConfig } = load('src/lib/parser/ocrConfig.ts');
  process.env.OCR_API_KEY = 'ocr-test';
  process.env.OCR_BASE_URL = 'http://127.0.0.1:3999/v1/';
  assert.equal(getOcrConfig().apiKey, 'ocr-test');
  assert.equal(getOcrConfig().baseUrl, 'http://127.0.0.1:3999/v1');
  delete process.env.OCR_API_KEY;
  assert.throws(getOcrConfig);
  console.log('✓ OCR 独立配置不依赖普通模型密钥');
  const { MemoryStore } = load('src/lib/store/memoryStore.ts');
  const memory = new MemoryStore();
  const s1 = { id: 's1', resumeAnalysisId: 'analysis', questions: [], plan: [], status: 'active' };
  await memory.saveResumeAnalysis({ id: 'analysis' });
  await memory.saveSession(s1);
  await memory.saveSession({ ...s1, id: 's2', basedOnSessionId: 's1' });
  await memory.saveReport({ sessionId: 's2', comparison: { baseSessionId: 's1' } });
  await memory.deleteRecord('s1');
  assert(await memory.getResumeAnalysis('analysis'));
  assert.equal((await memory.getSession('s2')).basedOnSessionId, undefined);
  assert.equal((await memory.getReportBySession('s2')).comparison, undefined);
  await memory.saveReport({ sessionId: 's2', comparison: { baseSessionId: 's1' } });
  assert.equal((await memory.getReportBySession('s2')).comparison, undefined, 'Late report must not restore deleted first-round evidence');
  await memory.deleteRecord('s2');
  await assert.rejects(() => memory.saveReport({ sessionId: 's2' }), (error) => error.status === 404);
  assert.equal(await memory.getReportBySession('s2'), null);
  assert.equal(await memory.getResumeAnalysis('analysis'), null);
  assert.equal(await memory.updateSession(s1, []), false);
  console.log('✓ 删除首轮保留共享简历并移除对比，删除末次引用清理简历，旧更新不能复活会话');
  const { StoreFacade } = load('src/lib/store/memoryStore.ts');
  process.env.DATABASE_URL = 'postgres://unused';
  const facade = new StoreFacade('test');
  let failing = true;
  facade.primary = { getSession: async () => { if (failing) throw new Error('Database offline'); return s1; } };
  await assert.rejects(() => facade.getSession('s1'), (error) => error.status === 503);
  assert.equal(facade.kind, 'postgres');
  failing = false;
  assert.equal((await facade.getSession('s1')).id, 's1');
  process.env.DATABASE_URL = ' ';
  console.log('✓ 数据库故障返回 503，恢复后可重试且不会切换空内存');
}
module.exports = { load };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
