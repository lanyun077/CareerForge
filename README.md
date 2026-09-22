# CareerForge

CareerForge 是一个面向计算机专业学生的 AI 求职训练平台。它把简历分析、职业方向推荐、岗位匹配、模拟面试和复盘训练串成一个可重复的闭环：

~~~text
简历 / PDF
   -> 推荐 3-5 个职业方向
   -> 搜索方向或导入企业 JD
   -> 岗位匹配与缺口分析
   -> 岗位专项模拟面试
   -> 证据化评分与复盘
   -> 二次专项挑战与前后对比
~~~

项目当前是可运行的 MVP，默认支持无模型的规则兜底模式；配置兼容 OpenAI API 的模型后，可启用千问等模型完成语义分析、出题、追问、评分文案和扫描 PDF OCR。

## 当前状态

- 技术栈：Next.js 14、React 18、TypeScript、Tailwind CSS
- 开发分支：develop
- 存储：默认内存；配置 DATABASE_URL 后使用 PostgreSQL / Supabase
- 模型：OpenAI-compatible chat/completions，推荐使用阿里云百炼兼容接口的千问模型
- 测试：构建、规则兜底冒烟和 Mock 模型链路均已提供
- 详细接手说明：[docs/项目接手指南.md](docs/项目接手指南.md)

## 功能

### 求职准备闭环

1. 粘贴简历文本，或上传文本型 PDF。
2. 扫描型 PDF 在没有文字层时尝试调用视觉模型 OCR。
3. 根据技能、项目证据和模型语义匹配，返回最多 5 个职业方向，并按匹配度和星级排序。
4. 搜索其他方向，或粘贴真实招聘 JD 导入具体岗位。
5. 针对选定岗位重新分析已满足项、技能缺口、证据缺口和补齐动作。
6. 进行岗位专项面试：自我介绍、项目经历、技术题、场景题和行为题；每题最多追问一次。
7. 生成五维复盘报告，并根据薄弱维度发起第二轮专项挑战。
8. 在训练记录中查看或删除历史会话。

### 推荐与岗位范围

内置职业方向覆盖软件工程、前端、后端、数据、测试开发、AI/Agent、算法、云原生、网络安全和移动端等方向。系统还支持用户搜索方向以及导入企业 JD。

当前推荐的是可维护的职业方向，不是招聘网站实时职位。实时职位需要后续接入获得授权的招聘 API、企业招聘 Feed 或其他合法数据源，不使用未经许可的全网爬虫。

### 可解释与降级

- 推荐结果展示匹配分、星级、推荐理由、简历技能证据和能力缺口。
- 评分报告展示维度分、回答证据、失分原因和下一步建议。
- 模型未配置、调用失败或输出不合规时，自动切换到固定题库、规则追问、规则评分和规则报告，不阻断面试流程。
- PDF 解析失败时明确提示用户粘贴简历文本；OCR 不可用时也可继续使用文本流程。

项目不预测真实录取概率，不替代真实面试官，不根据性别、年龄、地域或学校层次评价用户。

## 快速开始

### 环境要求

- Node.js >= 18.17
- npm
- PostgreSQL / Supabase（可选）
- 支持 OpenAI-compatible API 的大模型（可选）

### 安装和启动

Windows PowerShell：

~~~powershell
git clone https://github.com/lanyun077/CareerForge.git
cd CareerForge
npm install
Copy-Item .env.example .env.local
npm run dev
~~~

macOS / Linux：

~~~bash
git clone https://github.com/lanyun077/CareerForge.git
cd CareerForge
npm install
cp .env.example .env.local
npm run dev
~~~

打开 <http://localhost:3000>。不配置任何模型也可以完整体验“简历分析 → 面试 → 报告 → 二次挑战”的规则兜底流程。

## 千问模型配置

不要把真实 API Key 写入 README、源码或 Git。只在本地 .env.local 中配置，并确认该文件已被 .gitignore 忽略。

阿里云百炼兼容接口示例：

~~~env
OPENAI_API_KEY=你的千问APIKey
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-plus

# 扫描 PDF OCR，模型需要支持图片输入
OCR_MODEL=qwen-vl-plus
OCR_API_KEY=
OCR_BASE_URL=
~~~

OCR 会优先读取 OCR_API_KEY 和 OCR_BASE_URL；为空时复用普通模型配置。若没有配置视觉模型，文本型 PDF 仍可解析，扫描 PDF 会返回可操作的降级提示。

其他 OpenAI-compatible 服务只需替换 OPENAI_BASE_URL 和 OPENAI_MODEL。完整变量模板见 [.env.example](.env.example)。

## PostgreSQL 持久化

未配置数据库时，数据保存在当前 Node.js 进程内存中，服务重启后会清空，适合本地开发和演示。配置 DATABASE_URL 后，执行数据库脚本：

~~~bash
psql "$DATABASE_URL" -f db/schema.sql
~~~

当前持久化结构包括：

- resume_analyses：简历分析与岗位快照
- job_postings：用户导入的企业 JD
- recommendation_runs：一次推荐请求及其结果
- role_snapshots：推荐、分析和面试使用过的岗位快照
- interview_sessions：面试状态、问题、回答和岗位快照
- review_reports：复盘报告与两轮对比

数据库不可用时，系统会记录告警并自动降级到内存存储。访问 GET /api/health 可以查看当前模型模式和存储模式。

## 测试与验证

### 构建和规则兜底冒烟

~~~bash
npm run build
npm run start -- -p 3210
npm run smoke -- http://localhost:3210
~~~

冒烟测试覆盖简历分析、岗位选择、首轮面试、追问、报告、二次挑战、两轮对比和记录删除，预期为 35 通过，0 失败。

### Mock 模型链路

启动 Mock 模型服务：

~~~bash
node scripts/mock-llm.mjs 3999
~~~

在另一个终端启动应用并验证在线链路：

~~~bash
OPENAI_API_KEY=mock \
OPENAI_BASE_URL=http://127.0.0.1:3999/v1 \
npm run start -- -p 3211

npm run smoke:llm -- http://127.0.0.1:3211 --expect llm
~~~

验证模型返回垃圾内容时是否正确降级：

~~~bash
node scripts/mock-llm.mjs 3999 --garbage
npm run smoke:llm -- http://127.0.0.1:3211 --expect fallback
~~~

提交前建议执行：

~~~bash
git diff --check
git status
~~~

## 项目结构

~~~text
src/
├─ app/
│  ├─ page.tsx                    首页工作台与系统状态
│  ├─ resume/page.tsx             简历输入、PDF、岗位推荐和匹配分析
│  ├─ interview/page.tsx          模拟面试工作区
│  ├─ report/[sessionId]/page.tsx 复盘报告和二次挑战
│  ├─ records/page.tsx            训练记录
│  └─ api/                        Route Handlers 后端接口
├─ lib/
│  ├─ types.ts                    核心类型：RoleProfile、JobPosting 等
│  ├─ roles/                      职业方向目录、岗位工厂和搜索
│  ├─ services/                   推荐、简历、面试、评分、报告和 ASR
│  ├─ llm/                        模型客户端、提示词和输出校验
│  ├─ parser/                     PDF 文本提取和视觉 OCR
│  └─ store/                      内存存储与 PostgreSQL 存储
├─ scripts/                       冒烟测试和 Mock 模型
├─ db/schema.sql                  PostgreSQL / Supabase 表结构
└─ test-data/                     自制虚构测试语料
~~~

## 核心设计

### RoleProfile 与 JobPosting

- RoleProfile：稳定的职业方向，例如 Python 后端、Agent、数据分析或云原生。
- JobPosting：具体企业岗位或用户导入的 JD，包含原始描述、来源、公司和岗位要求。
- RoleTarget：服务层统一接受 RoleProfile | JobPosting，让推荐方向和真实 JD 都能进入同一套分析、面试和报告流程。

### 模型与程序的职责边界

模型负责语义理解、内容生成、证据提取和解释；程序负责硬技能匹配、排序、星级换算、面试状态机、题数限制、总分计算、字段校验、持久化和降级。这样可以避免模型输出不稳定时破坏核心流程。

### 评分维度

| 维度 | 权重 |
|---|---:|
| 表达结构 | 25% |
| 回答具体性 | 25% |
| 岗位相关性 | 20% |
| 项目证据 | 20% |
| 技术完整度 | 10% |

总分由后端按固定权重计算，报告中的分数表示模拟训练表现，不代表录取概率。

## 主要接口

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | /api/health | 查看模型、存储和 ASR 状态 |
| GET | /api/roles | 获取职业方向和已保存岗位 |
| POST | /api/roles/recommend | 根据简历推荐最多 5 个方向 |
| POST | /api/roles/import | 将用户 JD 解析并保存为 JobPosting |
| POST | /api/resume/parse-pdf | 提取 PDF 文本，必要时尝试 OCR |
| POST | /api/resume/analyze | 分析简历与岗位的匹配度 |
| POST | /api/interview/start | 开始首轮或二次专项面试 |
| POST | /api/interview/answer | 提交回答并推进面试状态机 |
| GET | /api/interview/session/:id | 读取当前面试会话 |
| GET | /api/report/:sessionId | 生成或读取复盘报告 |
| GET | /api/records | 获取训练记录 |
| DELETE | /api/records?id=... | 删除训练记录及关联数据 |

## 已知限制与下一步

- 当前推荐的是职业方向，不是实时招聘平台职位。
- OCR 已接入视觉模型链路，但复杂多栏、旋转、低清扫描件仍需真实样本回归。
- 尚未接入 Word/DOCX 简历解析。
- 未配置数据库时重启会丢失训练记录和用户导入岗位。
- 当前没有用户登录和数据隔离，不适合直接作为多用户生产系统公开部署。
- 真实职位搜索、收藏、投递记录、简历版本和职位过期处理仍待实现。

建议迭代顺序：真实职位数据适配器 → 来源/更新时间/过期处理 → 账号与数据隔离 → 简历和岗位版本 → OCR 质量评估 → 生产监控与成本统计。

## 项目文档

- [项目接手指南](docs/项目接手指南.md)：启动、环境变量、接口、测试和协作约定
- [项目完整方案与当前进度](docs/项目完整方案与当前进度.md)：产品方案、完成度和下一阶段计划
- [任务进度与阶段迭代表](docs/任务进度与阶段迭代表.md)：按阶段拆分的迭代任务
- [AI 求职实训教练项目方案](docs/AI求职实训教练项目方案.md)：完整产品设计与验收思路
- [部署指南](docs/部署指南.md)：Vercel + Supabase 公网部署

## 隐私与安全

- .env.local、API Key、数据库密码和本地日志禁止提交到 Git。
- 测试简历和回答均为自制虚构数据，不应上传真实个人信息到公共测试环境。
- 用户可以在训练记录页删除训练数据；正式多用户版本必须增加身份认证和访问控制。

## 许可证

见 [LICENSE](LICENSE)。
