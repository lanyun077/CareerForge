/**
 * 冒烟测试：完整跑通「简历分析 → 首轮面试（含追问）→ 复盘报告 →
 * 二次专项挑战 → 两次对比」闭环（无大模型时走题库 + 规则兜底链路）。
 *
 * 使用：先启动服务（npm run build && npm run start 或 npm run dev），
 * 然后 node scripts/smoke.mjs [baseUrl]
 */

const base = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

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
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function post(path, data) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 跑完一场面试：依次提交标准回答，直到 completed */
async function runInterview(sessionId, answers) {
  let i = 0;
  let current = (await api(`/api/interview/session/${sessionId}`)).body.data;
  for (let step = 0; step < 30; step++) {
    const q = current.questions.at(-1);
    const { body } = await post('/api/interview/answer', {
      sessionId,
      questionId: q.answer === undefined ? q.id : q.followUps.at(-1).id,
      answer: answers[i % answers.length],
    });
    if (!body.ok) throw new Error(`提交回答失败：${body.message}`);
    i++;
    const session = body.data.session;
    current = session;
    if (body.data.event === 'completed') return session;
  }
  throw new Error('面试未在预期步数内结束（疑似死循环）');
}

async function main() {
  console.log(`\nCareerForge 冒烟测试 → ${base}\n`);

  // 0. 健康检查
  console.log('[0] 健康检查');
  const health = await api('/api/health');
  check('GET /api/health 正常', health.body?.ok === true);
  console.log(`  模式：${health.body?.data?.mode}（llm=在线模型 / fallback=题库兜底）\n`);

  // 1. 岗位
  console.log('[1] 岗位配置');
  const roles = await api('/api/roles');
  check('GET /api/roles 正常', roles.body?.ok === true);
  const role = roles.body?.data?.[0];
  check('内置 Python 后端实习生岗位', role?.id === 'python-backend-intern');
  check(
    '岗位配置完整（职责/技能/阶段/评分规则/题库）',
    role?.requirements?.requiredSkills?.length > 0 &&
      role?.interviewStages?.length === 6 &&
      role?.scoringRubric?.length === 5 &&
      role?.questionBank?.length >= 15,
  );
  check('标注为模拟岗位', role?.isMock === true);
  console.log('');

  // 2. 简历分析
  console.log('[2] 简历分析');
  const demoRes = await fetch(`${base}/resume?demo=basic`);
  check('简历页可访问', demoRes.ok);
  const basicResume = FALLBACK_RESUME; // 与 src/lib/demo/sampleResumes.ts 基础版一致
  const answers = FALLBACK_ANSWERS;
  const analyze = await post('/api/resume/analyze', { roleId: role.id, resumeText: basicResume });
  check('POST /api/resume/analyze 正常', analyze.body?.ok === true, analyze.body?.message);
  const analysis = analyze.body?.data;
  check('输出结构化字段', Boolean(analysis?.extractedFields && Array.isArray(analysis?.gaps)));
  check('包含岗位缺口', analysis?.gaps?.length > 0);
  check('包含 3 条按优先级建议', analysis?.suggestions?.length === 3);
  check('匹配分在 0-100', analysis?.matchingScore >= 0 && analysis?.matchingScore <= 100);
  console.log(`  匹配分：${analysis?.matchingScore}，缺口：${analysis?.gaps?.length} 条，来源：${analysis?.source}\n`);

  // 3. 首轮面试
  console.log('[3] 首轮模拟面试');
  const start = await post('/api/interview/start', {
    roleId: role.id,
    resumeAnalysisId: analysis.id,
  });
  check('POST /api/interview/start 正常', start.body?.ok === true, start.body?.message);
  const s1 = start.body?.data;
  check('第一题已生成', Boolean(s1?.questions?.[0]?.text));
  check(
    '提问计划 5-7 题',
    s1?.plan?.length >= 5 && s1?.plan?.length <= 7,
    `实际 ${s1?.plan?.length} 题`,
  );

  let followedUp = false;
  let stepSession = s1;
  let i = 0;
  for (let step = 0; step < 30; step++) {
    const q = stepSession.questions.at(-1);
    const r = await post('/api/interview/answer', {
      sessionId: s1.id,
      questionId: q.answer === undefined ? q.id : q.followUps.at(-1).id,
      answer: answers[i % answers.length],
    });
    if (!r.body.ok) throw new Error(`提交回答失败：${r.body.message}`);
    i++;
    stepSession = r.body.data.session;
    if (r.body.data.event === 'followUp') followedUp = true;
    if (r.body.data.event === 'completed') break;
  }
  check('面试正常完成', stepSession?.status === 'completed');
  check('完成至少 5 个问题', (stepSession?.questions?.length ?? 0) >= 5);
  check('至少出现一次追问', followedUp);
  const fuWithQuote = (stepSession?.questions ?? [])
    .flatMap((q) => q.followUps)
    .some((f) => f.text.includes('「'));
  check('追问引用了回答/简历内容（「」引用）', fuWithQuote);
  const scoredQs = (stepSession?.questions ?? []).filter((q) => q.dimensionScores?.length === 5);
  check('每题都有 5 维评分', scoredQs.length === stepSession?.questions?.length);
  console.log(`  题目数：${stepSession?.questions?.length}，来源：${s1?.source ?? 'mixed'}\n`);

  // 4. 复盘报告
  console.log('[4] 复盘报告');
  const rep1 = await api(`/api/report/${s1.id}`);
  check('GET /api/report 正常', rep1.body?.ok === true, rep1.body?.message);
  const r1 = rep1.body?.data;
  check('包含 5 个维度得分', r1?.dimensionScores?.length === 5);
  check('总分在 0-100', r1?.overallScore >= 0 && r1?.overallScore <= 100, `${r1?.overallScore}`);
  check('包含主要失分原因', r1?.mainIssues?.length > 0);
  check('包含回答证据', r1?.evidence?.length > 0);
  check('包含下一轮训练建议', r1?.nextStepSuggestions?.length > 0);
  check('包含专项挑战（focusAreas）', r1?.nextChallenge?.focusAreas?.length > 0);
  const badWord = JSON.stringify(r1).match(/录取概率|offer概率/i);
  check('不出现「录取概率」等表述', !badWord);
  console.log(`  模拟表现分：${r1?.overallScore}，来源：${r1?.source}\n`);

  // 5. 二次专项挑战
  console.log('[5] 第二次专项挑战');
  const start2 = await post('/api/interview/start', {
    roleId: role.id,
    round: 2,
    basedOnSessionId: s1.id,
  });
  check('POST /api/interview/start（round=2）正常', start2.body?.ok === true, start2.body?.message);
  const s2 = start2.body?.data;
  check('聚焦首轮薄弱维度', (s2?.focusWeaknesses ?? []).length > 0);
  const s2done = await runInterview(s2.id, answers);
  check('第二轮面试正常完成', s2done?.status === 'completed');

  const rep2 = await api(`/api/report/${s2.id}`);
  check('第二轮复盘报告正常', rep2.body?.ok === true, rep2.body?.message);
  const r2 = rep2.body?.data;
  check('报告包含两次对比数据', Boolean(r2?.comparison));
  check('对比含各维度 delta', r2?.comparison?.dimensionDeltas?.length === 5);
  console.log(
    `  两轮分数：${r2?.comparison?.baseOverallScore} → ${r2?.comparison?.currentOverallScore}\n`,
  );

  // 6. 训练记录与删除
  console.log('[6] 训练记录');
  const records = await api('/api/records');
  check('GET /api/records 正常', records.body?.ok === true && records.body.data.length >= 2);
  const del = await api(`/api/records?id=${s1.id}`, { method: 'DELETE' });
  check('DELETE /api/records 可删除', del.body?.ok === true);

  // 总结
  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

const FALLBACK_RESUME = `李明
某大学 计算机科学与技术专业 本科在读（2023级）
求职意向：后端开发实习生

专业技能：
熟悉 Python，了解 Flask，会用 MySQL，会 Git。

项目经历
学生成绩管理系统：负责了系统的后端开发，完成了相关功能，使用了数据库存储数据。
校园二手交易平台：参与了平台的开发工作，实现了一些接口。

自我评价：学习能力强，能吃苦，希望获得实习机会。`;

const FALLBACK_ANSWERS = [
  '面试官您好，我叫测试同学，计算机专业本科在读，主要技术栈是 Python 和 Flask，做过一个订单管理系统，求职方向是后端开发实习生。',
  '我负责了系统的后端开发，完成了很多功能。',
  '大概做了一些接口和数据库的部分。',
  '这个项目用 Flask 和 MySQL 实现，我负责订单模块和库存模块。订单列表接口出现慢查询，我通过添加联合索引和分页优化，把响应时间从 800ms 降到 120ms，并用 ab 压测验证过结果。',
  '索引底层是 B+ 树，等值查询和范围查询可以走索引；对列使用函数、前缀通配符模糊匹配、隐式类型转换会导致索引失效。',
  '排查思路：先看监控确认是数据库还是服务本身的问题，再查慢查询日志定位 SQL，然后加索引或加缓存，最后用压测对比响应时间验证效果。',
  '背景是我们两个人对接口返回格式意见不一致，我列出了两种方案的优缺点并做了小样对比，最后采用了对前端更简单的一种，项目按时上线。',
  '今天最有信心的是项目经历的回答，因为数据都是我亲手做的；需要提升的是对高并发场景的理解。',
];

main().catch((err) => {
  console.error('\n冒烟测试异常中断：', err.message);
  process.exit(1);
});
