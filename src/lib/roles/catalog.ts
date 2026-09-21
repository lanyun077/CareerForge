import { createRole } from './roleFactory';
import type { RoleProfile } from '@/lib/types';

export const roleCatalog: RoleProfile[] = [
  createRole({
    id: 'java-backend-intern', name: 'Java 后端开发实习生',
    description: '参与 Java 服务、接口、数据库与线上问题排查，适合校招和实习训练。',
    requiredSkills: [
      { label: 'Java 基础', keywords: ['java'] },
      { label: 'Spring / Spring Boot', keywords: ['spring', 'spring boot', 'springboot'] },
      { label: 'MySQL / PostgreSQL', keywords: ['mysql', 'postgresql', '数据库'] },
      { label: 'RESTful 接口', keywords: ['restful', '接口', 'api'] },
      { label: 'Git 协作', keywords: ['git', 'github', 'gitee'] },
    ],
    preferredSkills: [
      { label: 'Redis', keywords: ['redis', '缓存'] },
      { label: 'Docker / Linux', keywords: ['docker', 'linux', '部署'] },
      { label: '消息队列', keywords: ['kafka', 'rabbitmq', '消息队列'] },
    ],
    commonProjectTypes: ['订单系统', '内容平台', '校园服务后端'],
  }),
  createRole({
    id: 'frontend-intern', name: '前端开发实习生',
    description: '参与 Web 前端页面、组件、交互和性能优化，适合前端实习面试训练。',
    requiredSkills: [
      { label: 'HTML / CSS', keywords: ['html', 'css'] },
      { label: 'JavaScript / TypeScript', keywords: ['javascript', 'typescript', 'js', 'ts'] },
      { label: 'React / Vue', keywords: ['react', 'vue', 'angular'] },
      { label: '接口联调', keywords: ['接口', 'api', 'axios', 'fetch'] },
      { label: 'Git 协作', keywords: ['git', 'github', 'gitee'] },
    ],
    preferredSkills: [
      { label: 'Webpack / Vite', keywords: ['webpack', 'vite'] },
      { label: '前端测试', keywords: ['jest', 'cypress', '测试'] },
      { label: '性能优化', keywords: ['性能优化', '首屏', 'lighthouse'] },
    ],
    commonProjectTypes: ['管理后台', '电商页面', '数据可视化平台'],
  }),
  createRole({
    id: 'data-analyst-intern', name: '数据分析实习生',
    description: '通过 SQL、Python 和可视化工具分析业务数据并输出可执行结论。',
    requiredSkills: [
      { label: 'SQL', keywords: ['sql', 'mysql', 'postgresql'] },
      { label: 'Python 数据分析', keywords: ['python', 'pandas', 'numpy'] },
      { label: '数据可视化', keywords: ['tableau', 'power bi', '可视化', 'matplotlib', 'excel'] },
      { label: '统计分析基础', keywords: ['统计', '假设检验', '回归', '概率'] },
      { label: '业务分析与表达', keywords: ['业务分析', '指标', '报告', '汇报'] },
    ],
    preferredSkills: [
      { label: '机器学习基础', keywords: ['机器学习', 'sklearn', '回归模型'] },
      { label: '数据仓库', keywords: ['数据仓库', 'etl', 'hive'] },
      { label: 'A/B 测试', keywords: ['a/b', 'ab测试', '实验'] },
    ],
    commonProjectTypes: ['用户增长分析', '销售报表', '运营数据看板'],
  }),
  createRole({
    id: 'qa-test-intern', name: '测试开发实习生',
    description: '参与测试设计、自动化测试、缺陷定位和质量保障流程建设。',
    requiredSkills: [
      { label: '测试用例设计', keywords: ['测试用例', '测试设计', '功能测试'] },
      { label: 'Python / Java', keywords: ['python', 'java'] },
      { label: '接口测试', keywords: ['接口测试', 'postman', 'jmeter'] },
      { label: '自动化测试', keywords: ['自动化测试', 'selenium', 'pytest', '测试框架'] },
      { label: '缺陷定位与协作', keywords: ['缺陷', 'bug', 'jira', 'git'] },
    ],
    preferredSkills: [
      { label: '持续集成', keywords: ['ci', 'cd', 'jenkins', 'github actions'] },
      { label: '性能测试', keywords: ['性能测试', '压测', 'jmeter'] },
      { label: 'Linux', keywords: ['linux', 'shell'] },
    ],
    commonProjectTypes: ['Web 应用测试', '接口自动化', '质量平台'],
  }),
  createRole({
    id: 'llm-app-intern', name: '大模型应用工程师', category: 'AI/Agent', aliases: ['LLM Engineer', '生成式 AI', 'AI 应用开发'],
    description: '使用大模型 API、RAG 和工具调用构建可交付的 AI 应用。',
    requiredSkills: [
      { label: 'Python / JavaScript', keywords: ['python', 'javascript', 'typescript', 'js'] },
      { label: '大模型 API 与 Prompt', keywords: ['大模型', 'llm', 'prompt', '提示词', 'openai', 'qwen', '千问'] },
      { label: '后端接口开发', keywords: ['后端', 'api', '接口', 'fastapi', 'flask', 'node'] },
      { label: '数据处理与评测', keywords: ['数据处理', '评测', 'evaluation', '准确率'] },
    ],
    preferredSkills: [
      { label: 'RAG / 向量数据库', keywords: ['rag', '向量数据库', 'milvus', 'pgvector', 'chromadb'] },
      { label: 'LangChain / LlamaIndex', keywords: ['langchain', 'llamaindex', 'llama index'] },
      { label: 'Docker / 云部署', keywords: ['docker', '云部署', 'linux'] },
    ],
    commonProjectTypes: ['知识库问答', '智能客服', 'AI 助手'],
  }),
  createRole({
    id: 'agent-engineer-intern', name: 'Agent/智能体开发工程师', category: 'AI/Agent', aliases: ['Agent 工程师', '智能体工程师', 'AI Agent'],
    description: '设计智能体工作流、工具调用、记忆与评测机制，解决复杂任务自动化问题。',
    requiredSkills: [
      { label: 'Python 工程开发', keywords: ['python'] },
      { label: 'LLM 与工具调用', keywords: ['llm', '大模型', '工具调用', 'function calling', 'tool calling'] },
      { label: '工作流与状态管理', keywords: ['工作流', '状态管理', '多轮', 'workflow', 'langgraph'] },
      { label: 'API / 系统集成', keywords: ['api', '接口', '系统集成', '后端'] },
    ],
    preferredSkills: [
      { label: 'RAG 与知识库', keywords: ['rag', '知识库', '向量'] },
      { label: 'Agent 评测与安全', keywords: ['评测', '幻觉', '安全', 'guardrail'] },
      { label: 'LangChain / LangGraph', keywords: ['langchain', 'langgraph'] },
    ],
    commonProjectTypes: ['自动化工作流', '智能客服', '代码 Agent'],
  }),
  createRole({
    id: 'algorithm-intern', name: '算法工程师实习生', category: 'AI/数据', aliases: ['机器学习工程师', '深度学习工程师', '算法实习生'],
    description: '围绕机器学习、深度学习或推荐算法完成数据处理、训练、评估和部署。',
    requiredSkills: [
      { label: 'Python 与数据处理', keywords: ['python', 'numpy', 'pandas'] },
      { label: '机器学习基础', keywords: ['机器学习', 'machine learning', 'sklearn', '监督学习'] },
      { label: '模型训练与评估', keywords: ['模型训练', '训练', '准确率', '召回率', 'f1', '评估'] },
      { label: '数学与统计基础', keywords: ['线性代数', '概率', '统计', '微积分'] },
    ],
    preferredSkills: [
      { label: 'PyTorch / TensorFlow', keywords: ['pytorch', 'tensorflow'] },
      { label: 'NLP / 计算机视觉', keywords: ['nlp', '自然语言', '计算机视觉', 'cv', 'transformer'] },
      { label: '模型部署', keywords: ['模型部署', 'onnx', '推理', 'docker'] },
    ],
    commonProjectTypes: ['文本分类', '推荐系统', '图像识别'],
  }),
  createRole({
    id: 'data-engineer-intern', name: '数据开发工程师实习生', category: '数据/基础设施', aliases: ['数据工程师', 'ETL 开发', '数仓开发'],
    description: '建设数据采集、清洗、加工和数据仓库任务，为业务分析提供可靠数据。',
    requiredSkills: [
      { label: 'SQL', keywords: ['sql', 'mysql', 'postgresql'] },
      { label: 'Python / Java', keywords: ['python', 'java'] },
      { label: 'ETL 与数据建模', keywords: ['etl', '数据建模', '数据仓库', '数仓'] },
      { label: 'Linux / Git', keywords: ['linux', 'git', 'shell'] },
    ],
    preferredSkills: [
      { label: 'Hive / Spark', keywords: ['hive', 'spark'] },
      { label: 'Kafka / Flink', keywords: ['kafka', 'flink', '实时计算'] },
      { label: '云数据服务', keywords: ['数据湖', '云计算', 'dataworks'] },
    ],
    commonProjectTypes: ['数据仓库', '实时数仓', '数据管道'],
  }),
  createRole({
    id: 'devops-cloud-intern', name: 'DevOps/云原生工程师实习生', category: '基础设施', aliases: ['云计算工程师', 'SRE 实习生', '运维开发'],
    description: '负责自动化交付、云基础设施、监控和服务稳定性建设。',
    requiredSkills: [
      { label: 'Linux 与 Shell', keywords: ['linux', 'shell', 'bash'] },
      { label: 'Docker / 容器', keywords: ['docker', '容器'] },
      { label: 'CI/CD', keywords: ['ci/cd', '持续集成', 'jenkins', 'github actions'] },
      { label: '网络与服务排障', keywords: ['网络', 'nginx', '监控', '排障', '日志'] },
    ],
    preferredSkills: [
      { label: 'Kubernetes', keywords: ['kubernetes', 'k8s'] },
      { label: '云平台', keywords: ['阿里云', 'aws', 'azure', '云平台'] },
      { label: 'Terraform / Ansible', keywords: ['terraform', 'ansible'] },
    ],
    commonProjectTypes: ['容器化部署', '监控平台', '自动化发布'],
  }),
  createRole({
    id: 'security-intern', name: '网络安全工程师实习生', category: '安全', aliases: ['安全开发', '渗透测试', '安全运营'],
    description: '参与应用安全、漏洞排查、安全测试和安全运营流程建设。',
    requiredSkills: [
      { label: '网络基础', keywords: ['网络', 'tcp/ip', 'http', '网络安全'] },
      { label: 'Linux', keywords: ['linux', 'shell'] },
      { label: '安全测试与漏洞分析', keywords: ['渗透测试', '漏洞', '安全测试', 'owasp'] },
      { label: '脚本编程', keywords: ['python', 'java', 'javascript', '脚本'] },
    ],
    preferredSkills: [
      { label: '代码审计', keywords: ['代码审计', '静态分析'] },
      { label: '云安全', keywords: ['云安全', '容器安全'] },
      { label: '安全认证', keywords: ['ctf', 'cissp', '等保'] },
    ],
    commonProjectTypes: ['Web 安全测试', '漏洞扫描', '安全监控'],
  }),
  createRole({
    id: 'fullstack-intern', name: '全栈开发实习生', category: '软件工程', aliases: ['全栈工程师', 'Full Stack Developer'],
    description: '同时参与前端交互和后端服务开发，完成端到端业务功能交付。',
    requiredSkills: [
      { label: 'JavaScript / TypeScript', keywords: ['javascript', 'typescript', 'js', 'ts'] },
      { label: 'React / Vue', keywords: ['react', 'vue'] },
      { label: '后端接口开发', keywords: ['后端', 'api', '接口', 'node', 'python', 'java'] },
      { label: '关系型数据库', keywords: ['mysql', 'postgresql', 'sql', '数据库'] },
    ],
    preferredSkills: [
      { label: '云部署与 Docker', keywords: ['docker', '部署', 'linux'] },
      { label: '自动化测试', keywords: ['测试', 'jest', 'pytest'] },
      { label: '性能优化', keywords: ['性能优化', '缓存'] },
    ],
    commonProjectTypes: ['SaaS 应用', '管理后台', '电商系统'],
  }),
  createRole({
    id: 'mobile-intern', name: '移动端开发实习生', category: '软件工程', aliases: ['Android 开发', 'iOS 开发', '移动开发'],
    description: '参与 Android、iOS 或跨端应用的功能开发、性能优化和发布。',
    requiredSkills: [
      { label: '移动端开发语言', keywords: ['java', 'kotlin', 'swift', 'dart', 'android', 'ios', 'flutter'] },
      { label: '移动端 UI 与生命周期', keywords: ['android', 'ios', 'flutter', 'ui', '生命周期'] },
      { label: '网络与接口调用', keywords: ['http', '网络', '接口', 'api'] },
      { label: 'Git 协作', keywords: ['git', 'github', 'gitee'] },
    ],
    preferredSkills: [
      { label: '性能与稳定性优化', keywords: ['性能优化', '崩溃', '监控'] },
      { label: '自动化测试', keywords: ['测试', '自动化'] },
      { label: '跨端框架', keywords: ['flutter', 'react native', '鸿蒙'] },
    ],
    commonProjectTypes: ['移动 App', '跨端应用', '校园服务 App'],
  }),
];
