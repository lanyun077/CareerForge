/**
 * mock-llm：本地假 OpenAI-compatible 服务，用于在不消耗真实 API 的情况下
 * 验证 CareerForge 的完整在线链路（出题 / 追问 / 评分 / 复盘文案 / 简历分析）。
 *
 * 用法：
 *   node scripts/mock-llm.mjs [port]        # 正常模式，按系统提示词返回合法 JSON
 *   node scripts/mock-llm.mjs [port] --garbage  # 永远返回非 JSON，验证重试+降级
 *
 * 应用侧配置（.env.local 或启动环境变量）：
 *   OPENAI_API_KEY=mock-key
 *   OPENAI_BASE_URL=http://127.0.0.1:3999/v1
 *   OPENAI_MODEL=mock-model
 */

import http from 'node:http';

const port = Number(process.argv[2] || 3999);
const garbage = process.argv.includes('--garbage');

const DIMENSIONS = [
  { name: '表达结构', score: 4, maxScore: 5, evidence: '「mock证据：回答有背景和结果」', suggestion: '补充任务与行动之间的衔接' },
  { name: '回答具体性', score: 4, maxScore: 5, evidence: '「mock证据：提到响应时间从 800ms 降到 120ms」', suggestion: '再补充数据规模与测量方式' },
  { name: '岗位相关性', score: 4, maxScore: 5, evidence: '「mock证据：围绕后端接口与数据库展开」', suggestion: '对照岗位必备技能逐条回应' },
  { name: '项目证据', score: 4, maxScore: 5, evidence: '「mock证据：说明了负责的模块与分工」', suggestion: '补充能证明亲手参与的细节' },
  { name: '技术完整度', score: 4, maxScore: 5, evidence: '「mock证据：解释了索引与慢查询」', suggestion: '补充边界情况与取舍' },
];

function mockContentFor(system, user) {
  if (system.includes('简历分析')) {
    return {
      extractedFields: {
        education: '某大学 计算机相关专业 本科在读（mock）',
        skills: ['Python', 'Flask', 'MySQL', 'Git'],
        projects: [
          {
            name: '订单管理系统',
            description: '负责订单与库存模块的后端开发（mock）',
            stack: ['Flask', 'MySQL'],
            results: '响应时间从 800ms 优化到 120ms（mock）',
          },
        ],
        achievements: ['接口测试覆盖率 85%（mock）'],
      },
      matchedSkills: ['Python 基础与常用标准库', 'Git 版本控制与协作'],
      gaps: [
        {
          requirement: 'Redis 缓存',
          current: '简历中未提及缓存相关内容',
          problem: '岗位加分项缺少证据',
          suggestion: '在项目中补充 Redis 的使用场景与效果',
          evidence: '（mock）简历技能段未出现 redis',
        },
        {
          requirement: '数据库优化（索引 / 慢查询）',
          current: '提到会使用 MySQL',
          problem: '没有说明数据规模、优化方法和结果',
          suggestion: '补充索引设计、慢查询优化以及响应时间变化',
          evidence: '「会用 MySQL」',
        },
      ],
      vagueIssues: ['「负责了系统的后端开发」——缺少具体模块与量化结果（mock）'],
      suggestions: [
        { priority: 1, title: '补齐数据库优化证据（mock）', detail: '写清数据量、索引方案与性能变化。' },
        { priority: 2, title: '为项目补充量化结果（mock）', detail: '每段项目经历至少 2 个可验证数字。' },
        { priority: 3, title: '对准岗位关键词（mock）', detail: '突出接口设计与部署相关职责。' },
      ],
      matchingScore: 72,
    };
  }
  if (system.includes('面试出题')) {
    return {
      questions: [
        { stageId: 'self-intro', text: '请用一分钟介绍你与 Python 后端相关的教育背景、技能栈和求职方向。', tags: ['结构', '总结'] },
        { stageId: 'project', text: '介绍你简历中的「订单管理系统」：项目背景、你负责的模块、技术方案和最终结果。', tags: ['项目', 'STAR', '结果'] },
        { stageId: 'project', text: '这个项目里你遇到过最棘手的技术问题是什么？说说定位过程和验证解决效果的方法。', tags: ['项目', '量化'] },
        { stageId: 'tech', text: '结合你的项目讲讲 MySQL 索引的原理，以及哪些写法会让索引失效。', tags: ['技术', '原理'] },
        { stageId: 'scenario', text: '如果该系统高峰期接口响应时间变成平时的 10 倍，你的完整排查与优化思路是什么？', tags: ['场景', '量化'] },
        { stageId: 'behavior', text: '讲一次你和团队成员在技术方案上出现分歧的经历，以及最终如何达成一致。', tags: ['STAR', '结构'] },
        { stageId: 'wrap', text: '最后总结一下：你今天表现最有信心的部分和最需要提升的部分分别是什么？', tags: ['总结', '结构'] },
      ],
    };
  }
  if (system.includes('追问生成模块')) {
    const quote = user.split('【候选人回答】\n')[1]?.split('\n')[0]?.slice(0, 24) || '无回答';
    return {
      needFollowUp: true,
      text: `你刚才提到「${quote}」——具体是哪几个模块？其中遇到过什么问题，你是如何验证解决方案有效的？`,
      reason: '回答中「负责后端开发」缺少模块、问题与验证方式（mock）',
    };
  }
  if (system.includes('评分模块')) {
    const quote = user.split('【候选人回答】\n')[1]?.split('\n')[0]?.slice(0, 24) || '无回答';
    return { dimensions: DIMENSIONS.map((dim) => ({ ...dim, evidence: `「${quote}」` })), followUpReason: '回答缺少量化与验证细节（mock）', confidence: 'medium' };
  }
  if (system.includes('复盘')) {
    return {
      mainIssues: [
        '项目描述缺少量化结果，多数回答没有数据支撑（mock）',
        '技术原理回答不完整，边界情况说明不足（mock）',
      ],
      nextStepSuggestions: [
        '为每个项目准备 2-3 个量化指标（数据量 / 性能变化 / 覆盖率）并能说明测量方式（mock）',
        '复习 MySQL 索引与缓存原理，练习用「定义 + 场景 + 边界」结构作答（mock）',
      ],
      nextChallenge: {
        focusAreas: ['回答具体性', '技术完整度'],
        description: '本次专项挑战围绕量化表达与技术原理重新出题，验证上一轮暴露的问题是否改善。（mock）',
        recommendedQuestions: ['mock 推荐题 1', 'mock 推荐题 2'],
      },
    };
  }
  return {};
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let system = '';
    let userLen = 0;
    let user = '';
    try {
      const parsed = JSON.parse(body);
      system = String(parsed?.messages?.[0]?.content ?? '');
      user = String(parsed?.messages?.[1]?.content ?? '');
      userLen = user.length;
    } catch {
      /* ignore */
    }
    const content = garbage ? '很抱歉，我无法以JSON形式回答{{{bad' : JSON.stringify(mockContentFor(system, user));
    const tag = garbage ? 'GARBAGE' : system.includes('简历分析')
      ? 'resume'
      : system.includes('面试出题')
        ? 'plan'
        : system.includes('追问')
          ? 'followup'
          : system.includes('评分模块')
            ? 'scoring'
            : system.includes('复盘')
              ? 'report'
              : 'unknown';
    console.log(`[mock-llm] ${tag} <- user(${userLen} chars) -> ${garbage ? 'garbage' : 'json'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));
  });
});

server.listen(port, () => {
  console.log(`[mock-llm] listening on http://127.0.0.1:${port} mode=${garbage ? 'garbage' : 'normal'}`);
});
