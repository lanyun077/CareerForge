/**
 * smoke-llm：在线链路冒烟测试。
 *
 * 前置条件：
 *   1. mock 模型服务已启动：node scripts/mock-llm.mjs 3999（或 3999 --garbage）
 *   2. 应用以 OPENAI_API_KEY / OPENAI_BASE_URL=http://127.0.0.1:3999/v1 启动
 *
 * 用法：
 *   node scripts/smoke-llm.mjs [baseUrl] --expect llm       # mock 正常模式：断言全链路走模型
 *   node scripts/smoke-llm.mjs [baseUrl] --expect fallback  # mock 垃圾模式：断言重试后降级且流程不中断
 */

const base = process.argv[2] || 'http://127.0.0.1:3000';
// --expect llm|fallback（默认 llm）
const expectIdx = process.argv.indexOf('--expect');
const expect =
  expectIdx !== -1 && process.argv[expectIdx + 1] === 'fallback' ? 'fallback' : 'llm';

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` —— ${detail}` : ''}`);
  }
}

async function api(path, options) {
  const res = await fetch(`${base}${path}`, options);
  return res.json().catch(() => ({}));
}

async function post(path, data) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

const RESUME = `李明
某大学 计算机科学与技术专业 本科在读（2023级）
求职意向：后端开发实习生

专业技能：
熟悉 Python，了解 Flask，会用 MySQL，会 Git。

项目经历
学生成绩管理系统：负责了系统的后端开发，完成了相关功能，使用了数据库存储数据。
校园二手交易平台：参与了平台的开发工作，实现了一些接口。

自我评价：学习能力强，能吃苦，希望获得实习机会。`;

const VAGUE_ANSWERS = [
  '面试官您好，我是测试同学，计算机专业在读，会 Python 和 Flask，做过一个管理系统。',
  '我负责了系统的后端开发，完成了很多功能。',
  '大概做了一些接口和数据库的部分。',
  '这个项目大概就是增删改查，没什么特别的。',
  '遇到问题就上网查资料，或者问同学。',
  '性能还行，没有专门测过。',
  '团队协作就是分工写代码，最后合并。',
  '我认为我的优点是认真，缺点是有时候太认真。',
];

async function runInterview(sessionId, answers) {
  let i = 0;
  let current = (await api(`/api/interview/session/${sessionId}`)).data;
  for (let step = 0; step < 30; step++) {
    const q = current.questions.at(-1);
    const body = await post('/api/interview/answer', {
      sessionId,
      questionId: q.answer === undefined ? q.id : q.followUps.at(-1).id,
      answer: answers[i++ % answers.length],
    });
    if (!body.ok) throw new Error(`提交回答失败：${body.message}`);
    current = body.data.session;
    if (body.data.event === 'completed') return body.data.session;
  }
  throw new Error('面试未在预期步数内结束');
}

async function main() {
  console.log(`\nsmoke-llm → ${base}（预期链路：${expect}）\n`);

  // 0. 健康检查：模型已配置
  const health = await api('/api/health');
  check('模型已配置（mode=llm）', health?.data?.mode === 'llm', `实际 ${health?.data?.mode}`);
  console.log(`  模型：${health?.data?.llmModel}，存储：${health?.data?.store}\n`);

  // 1. 简历分析
  console.log('[1] 简历分析');
  const analyze = await post('/api/resume/analyze', {
    roleId: 'python-backend-intern',
    resumeText: RESUME,
  });
  check('分析成功', analyze?.ok === true, analyze?.message);
  const analysis = analyze?.data;
  check(
    `分析来源=${expect === 'llm' ? 'llm' : 'rule(降级)'}`,
    analysis?.source === (expect === 'llm' ? 'llm' : 'rule'),
    `实际 ${analysis?.source}`,
  );
  check('结构完整（缺口+建议+匹配分）', (analysis?.gaps?.length ?? 0) > 0 && analysis?.suggestions?.length === 3);
  console.log('');

  // 2. 面试
  console.log('[2] 模拟面试');
  const start = await post('/api/interview/start', {
    roleId: 'python-backend-intern',
    resumeAnalysisId: analysis.id,
  });
  const s1 = start?.data;
  check('开始训练', start?.ok === true, start?.message);
  const llmPlanCount = (s1?.plan ?? []).filter((p) => p.source === 'llm').length;
  if (expect === 'llm') {
    check('提问计划主要由模型生成', llmPlanCount >= 5, `实际 ${llmPlanCount}/${s1?.plan?.length}`);
  } else {
    check('降级后提问计划全部来自题库', llmPlanCount === 0);
  }

  const done = await runInterview(s1.id, VAGUE_ANSWERS);
  check('面试完成', done?.status === 'completed');
  const allFollowUps = (done?.questions ?? []).flatMap((q) => q.followUps);
  const llmFollowUps = allFollowUps.filter((f) => f.source === 'llm').length;
  if (expect === 'llm') {
    check('出现模型生成的追问', llmFollowUps > 0, `实际 ${llmFollowUps}`);
    check('追问引用回答原文（「」）', allFollowUps.some((f) => f.text.includes('「')));
  } else {
    check('降级后追问走规则且仍引用原文', allFollowUps.some((f) => f.source === 'rule' && f.text.includes('「')));
  }
  const scored = (done?.questions ?? []).every((q) => (q.dimensionScores?.length ?? 0) === 5);
  check('每题 5 维评分完整', scored);
  console.log('');

  // 3. 复盘报告
  console.log('[3] 复盘报告');
  const rep1 = await api(`/api/report/${s1.id}`);
  const r1 = rep1?.data;
  check('报告生成', rep1?.ok === true, rep1?.message);
  check(
    `报告来源=${expect === 'llm' ? 'llm' : 'rule(降级)'}`,
    r1?.source === (expect === 'llm' ? 'llm' : 'rule'),
    `实际 ${r1?.source}`,
  );
  console.log(`  模拟表现分：${r1?.overallScore}\n`);

  // 4. 二轮 + 对比
  console.log('[4] 二次挑战与对比');
  const start2 = await post('/api/interview/start', {
    roleId: 'python-backend-intern',
    round: 2,
    basedOnSessionId: s1.id,
  });
  check('二轮开始', start2?.ok === true, start2?.message);
  const s2 = start2?.data;
  await runInterview(s2.id, VAGUE_ANSWERS);
  const rep2 = await api(`/api/report/${s2.id}`);
  check('二轮报告含两次对比', rep2?.data?.comparison?.dimensionDeltas?.length === 5);
  console.log(
    `  两轮分数：${rep2?.data?.comparison?.baseOverallScore} → ${rep2?.data?.comparison?.currentOverallScore}\n`,
  );

  console.log(`结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nsmoke-llm 异常中断：', err.message);
  process.exit(1);
});
