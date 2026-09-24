import type { BankQuestion } from '@/lib/types';
export const specialistQuestions: Record<string, BankQuestion[]> = {
  'frontend-intern': [
    { id: 'fe-tech-state', stage: 'tech', text: 'React 中连续更新状态和读取旧闭包分别会出现什么现象？结合你的组件说明如何避免。', tags: ['技术', '原理', '细节'] },
    { id: 'fe-tech-browser', stage: 'tech', text: '从输入 URL 到页面可交互经历哪些步骤？你如何定位首屏慢发生在哪个环节？', tags: ['技术', '原理', '量化'] },
    { id: 'fe-scene-race', stage: 'scenario', text: '搜索框快速输入时旧请求覆盖新结果，你如何处理请求竞态、加载状态和自动化验证？', tags: ['场景', '岗位相关', '结果'] },
    { id: 'fe-scene-access', stage: 'scenario', text: '弹窗在手机和键盘操作下无法关闭，你会如何检查焦点管理、语义标签和响应式布局？', tags: ['场景', '技术', '细节'] },
    { id: 'fe-project-metrics', stage: 'project', text: '选一次前端性能优化，说明基线指标、定位工具、具体改动以及优化后的测量条件。', tags: ['项目', '量化', '结果'] },
  ],
  'data-analyst-intern': [
    { id: 'da-tech-join', stage: 'tech', text: '订单表与用户标签表关联后销售额翻倍，你如何确认关联粒度并修正 SQL？', tags: ['技术', '原理', '细节'] },
    { id: 'da-tech-ab', stage: 'tech', text: 'A/B 实验有统计显著差异就能上线吗？请说明样本量、指标口径和实际收益的判断。', tags: ['技术', '原理', '量化'] },
    { id: 'da-scene-drop', stage: 'scenario', text: '日活突然下降 20%，你如何区分埋点故障、季节性和真实业务变化，并验证结论？', tags: ['场景', '岗位相关', '量化'] },
    { id: 'da-scene-bias', stage: 'scenario', text: '只分析留存用户后发现新功能效果很好，可能有哪些选择偏差？你如何设计对照分析？', tags: ['场景', '技术', '细节'] },
    { id: 'da-project-decision', stage: 'project', text: '介绍一次分析推动决策的经历：业务问题、数据清洗、指标口径、证据和后续结果分别是什么？', tags: ['项目', 'STAR', '结果'] },
  ],
};
