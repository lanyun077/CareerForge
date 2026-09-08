import type { Role } from '@/lib/types';

/**
 * 首版唯一岗位：Python 后端开发实习生（模拟岗位）
 * 对应项目方案 3.1 岗位配置：职责 / 必备技能 / 加分技能 / 常见项目类型 /
 * 面试阶段 / 评分维度与评分规则 / 预设面试问题
 */
export const pythonBackendIntern: Role = {
  id: 'python-backend-intern',
  name: 'Python 后端开发实习生',
  description: '互联网公司后端开发实习岗位：参与后端服务开发、接口设计与数据库优化。',
  isMock: true,
  mockNotice: '本岗位为模拟岗位（互联网公司 Python 后端开发实习生），不代表任何真实公司的招聘标准。',
  requirements: {
    responsibilities: [
      '参与后端服务的功能设计与开发，编写可维护的 Python 代码',
      '参与接口设计与实现，保证接口规范与稳定性',
      '参与 MySQL/PostgreSQL 数据表设计与查询优化',
      '编写单元测试，参与代码评审',
      '配合团队完成联调、部署与线上问题排查',
    ],
    requiredSkills: [
      { label: 'Python 基础与常用标准库', keywords: ['python'] },
      { label: '至少一个 Web 框架（Flask / FastAPI / Django）', keywords: ['flask', 'fastapi', 'django', 'tornado'] },
      { label: 'MySQL / PostgreSQL 等关系型数据库', keywords: ['mysql', 'postgresql', 'postgres', 'sqlite', '数据库'] },
      { label: 'RESTful 接口设计基础', keywords: ['restful', '接口设计', 'api'] },
      { label: 'Git 版本控制与协作', keywords: ['git', 'github', 'gitee'] },
      { label: 'Linux 常用命令与部署基础', keywords: ['linux', '部署', 'nginx', '服务器'] },
    ],
    preferredSkills: [
      { label: 'Redis 缓存', keywords: ['redis', '缓存'] },
      { label: '消息队列（RabbitMQ / Kafka / Celery）', keywords: ['rabbitmq', 'kafka', 'celery', '消息队列'] },
      { label: 'Docker 容器化', keywords: ['docker', '容器'] },
      { label: '数据库优化（索引 / 慢查询）', keywords: ['索引', '慢查询', '查询优化'] },
      { label: '单元测试（pytest / unittest）', keywords: ['pytest', 'unittest', '单元测试'] },
      { label: '异步编程（asyncio）', keywords: ['asyncio', '异步'] },
    ],
    commonProjectTypes: [
      '订单 / 库存管理系统',
      '内容发布平台（博客、社区）',
      '数据抓取与清洗工具',
      '小程序 / 校园服务后端',
    ],
  },
  interviewStages: [
    { id: 'self-intro', name: '自我介绍', questionCount: 1 },
    { id: 'project', name: '项目经历', questionCount: 2 },
    { id: 'tech', name: '技术问题', questionCount: 1 },
    { id: 'scenario', name: '场景问题', questionCount: 1 },
    { id: 'behavior', name: '行为问题', questionCount: 1 },
    { id: 'wrap', name: '总结', questionCount: 1 },
  ],
  // 评分维度与权重，对应项目方案 4.1：25 / 25 / 20 / 20 / 10
  scoringRubric: [
    { id: 'structure', name: '表达结构', weight: 0.25, focus: '是否有清晰的背景、任务、行动和结果（STAR）', maxScore: 5 },
    { id: 'specificity', name: '回答具体性', weight: 0.25, focus: '是否包含具体职责、方法、数据和结果', maxScore: 5 },
    { id: 'relevance', name: '岗位相关性', weight: 0.2, focus: '是否回答了目标岗位真正关心的能力', maxScore: 5 },
    { id: 'evidence', name: '项目证据', weight: 0.2, focus: '是否能证明用户确实参与并理解项目', maxScore: 5 },
    { id: 'tech', name: '技术完整度', weight: 0.1, focus: '技术概念、原理和方案是否基本完整', maxScore: 5 },
  ],
  // 固定题库兜底：每个阶段 3-5 个基础问题（方案 6.2）
  questionBank: [
    // 自我介绍
    { id: 'intro-1', stage: 'self-intro', text: '请用 1 分钟做一个自我介绍：你的专业背景、技术栈和求职方向。', tags: ['结构', '总结'] },
    { id: 'intro-2', stage: 'self-intro', text: '你为什么选择 Python 后端方向？你的技术栈主要覆盖哪些方面？', tags: ['技术', '总结'] },
    { id: 'intro-3', stage: 'self-intro', text: '说说你目前掌握最好的一项后端技能，以及你是怎么学会它的。', tags: ['技术', '细节'] },
    // 项目经历
    { id: 'proj-1', stage: 'project', text: '介绍一个你最能代表能力的项目：项目背景、你负责的部分、技术方案和最终结果。', tags: ['项目', 'STAR', '结果'] },
    { id: 'proj-2', stage: 'project', text: '这个项目中你遇到过的最难的技术问题是什么？你如何定位、解决并验证效果？', tags: ['项目', '细节', '量化'] },
    { id: 'proj-3', stage: 'project', text: '你的项目里哪个部分最能体现你符合本岗位的要求？请结合具体模块说明。', tags: ['项目', '岗位相关'] },
    { id: 'proj-4', stage: 'project', text: '如果这个项目的访问量增长 10 倍，你会先做哪些改造？', tags: ['技术', '场景'] },
    // 技术问题
    { id: 'tech-1', stage: 'tech', text: '讲讲数据库索引的原理，什么情况下索引会失效？', tags: ['技术', '原理'] },
    { id: 'tech-2', stage: 'tech', text: '什么是 RESTful 接口设计？GET 和 POST 在语义上有什么区别？', tags: ['技术', '原理'] },
    { id: 'tech-3', stage: 'tech', text: 'Python 的 GIL 是什么？它对多线程程序有什么影响？你会怎么绕开它？', tags: ['技术', '原理'] },
    { id: 'tech-4', stage: 'tech', text: '如果让你设计一个防重复提交的接口，你会怎么做？', tags: ['技术', '场景'] },
    // 场景问题
    { id: 'scene-1', stage: 'scenario', text: '线上一个接口响应时间从 50ms 涨到 2s，请说说你的完整排查思路。', tags: ['场景', '量化'] },
    { id: 'scene-2', stage: 'scenario', text: '设计一个商品秒杀接口的后端方案，需要考虑库存超卖问题。', tags: ['场景', '技术'] },
    { id: 'scene-3', stage: 'scenario', text: '你的服务需要给运营出一份每日数据报表，你会怎么设计和实现？', tags: ['场景', '岗位相关'] },
    // 行为问题
    { id: 'behav-1', stage: 'behavior', text: '讲一次你和团队伙伴意见不一致的经历：背景是什么，最后怎么解决的？', tags: ['STAR', '结构'] },
    { id: 'behav-2', stage: 'behavior', text: '如果项目截止日期临近，你发现自己负责的部分完不成，你会怎么做？', tags: ['结构', '细节'] },
    { id: 'behav-3', stage: 'behavior', text: '讲一次你从反馈或失败中学到东西的经历，以及之后你做了什么改变。', tags: ['STAR', '结果'] },
    // 总结
    { id: 'wrap-1', stage: 'wrap', text: '最后一分钟：总结一下你今天表现最有信心的部分，以及你认为还需要提升的部分。', tags: ['总结', '结构'] },
    { id: 'wrap-2', stage: 'wrap', text: '如果本次面试再给你一次机会回答其中一个问题，你会选哪个并怎么补充？', tags: ['总结', '结果'] },
  ],
};
