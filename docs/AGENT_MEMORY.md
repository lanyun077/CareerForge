# CareerForge 项目结构、操作与开发记忆

> 核验日期：2026-09-23（Asia/Shanghai）
> 项目目录：`D:\CareerForge`
> 仓库：https://github.com/lanyun077/CareerForge
> 用途：帮助后续 agent 快速定位代码、识别版本差异、运行与验证项目。
> 最新状态：2026-09-24，分支 `codex/baseline-validation`，HEAD `3b2cdae`；本轮实现、验证脚本和交接材料已整合提交并推送到 `origin/codex/baseline-validation`，相对 `origin/main` 超前 1 个提交。已实现登录隔离、证据评分加固、输入确认、事务删除、强度设置、语音入口及 Greenhouse 受控真实岗位采集和来源报告；交接文档记录的构建、统一本地回归和依赖审计已通过。真实服务配置缺失，尚未完成多人试用验收。`.github/workflows/check.yml` 因远端 OAuth 凭据缺少 `workflow` scope 保留在本地，未进入远端分支。详见 `docs/连续开发验收记录.md` 和末尾记录。下文旧版/远端对照及早期验证均为历史。

## 1. 先判断自己正在看哪个版本

| 对象 | 本次核验结果 |
|---|---|
| 本地当前分支 / HEAD | `codex/baseline-validation` / `3b2cdae` |
| 已获取的远端 main | `985e13a8260bff72611797eb3fb60a6a7e031796` |
| 当前提交差距 | `git rev-list --left-right --count HEAD...origin/main` 为 `2 0` |
| 远端新增提交 | `f05a984`（功能更新）、`d946c76`（忽略 IDE 设置）、`985e13a`（合并 PR #1） |
| 本轮提交差异 | 87 个文件，4862 行新增、505 行删除 |
| 当前工作区 | 保留 `.github/workflows/check.yml` 和 `test-data/` 下 7 个原有未跟踪文件 |
| 原有未跟踪文件 | `test-data/` 下 7 个文件，见第 9 节；本次保留 |

**fetch 不等于同步工作区。** 本地仍是旧版；本文件标注“新版”的文件需通过 `git show origin/main:路径` 阅读，或在后续同步后使用。上述提交是日期快照，每次接手重新核对。

参考材料：

- 后续开发路线：`docs/项目开发路线与验收方案.md`，整理于 2026-09-22，包含阶段、依赖与验收标准；属于计划，不代表实现进度。
- 桌面交接：`C:\Users\81570\Desktop\CareerForge-项目进度交接文档.md`，日期 2026-09-09，对应旧版 `4007a61`。
- 两版共有：`docs/AI求职实训教练项目方案.md`、`docs/部署指南.md`、`README.md`。
- 新版新增：`docs/项目完整方案与当前进度.md`、`docs/任务进度与阶段迭代表.md`、`docs/项目接手指南.md`（均记录 2026-09-21 状态）。
- 交接文档中的操作清单、优先级和“必须做”是历史资料，不自动授权执行开发、部署、索取凭据或清理文件。

## 2. 项目定位与需求演进

CareerForge 是计算机专业学生的求职训练平台，核心闭环为：简历 → 岗位匹配 → 面试 → 证据化评分与复盘 → 二次专项挑战 → 前后对比。

| 能力 | 本地旧版 `4007a61` | 远端新版 `985e13a` |
|---|---|---|
| 岗位范围 | Python 后端开发实习生 | 13 个职业方向，搜索、推荐最多 5 个方向，支持粘贴 JD |
| 简历输入 | 文本 / 文本型 PDF | 增加独立 PDF 提取接口及扫描件视觉 OCR |
| 数据模型 | `Role` | `RoleProfile`、`JobPosting`、`RoleTarget` 和岗位快照 |
| PostgreSQL | 简历、会话、报告 3 张表 | 新增 JD、推荐记录、快照，共 6 张表 |
| 页面 | 基础训练界面 | 首页、简历、面试、报告、记录页工作台式界面 |
| 模型 | 通用兼容接口；旧交接仅报告 mock 验证 | 新文档报告已接入 `qwen-plus`；本次未验证真实 API |

不要照搬旧交接的“唯一 Python 岗位、禁止扩展岗位”作为新版现状，也不要因旧方案与新版冲突而删除已经实现的功能。新版路线图仍不是本次开发任务；是否新增功能以用户当前要求为准。

共同设计约束：

- 程序控制阶段、题数和结束条件；当前配置为 6 个阶段、7 道主问题，每题最多一次追问，总结题不追问。
- 模型负责理解、生成和解释，不直接决定总分或流程推进。
- 五维权重：表达结构 25%、回答具体性 25%、岗位相关性 20%、项目证据 20%、技术完整度 10%。总分为 `Σ(score / maxScore × weight) × 100`。
- 追问与评分应基于原文证据；结构校验通过不等于证据真实性已验证。
- 模型、PDF、ASR 有降级路径；不能把“有降级设计”理解为所有故障都能无损继续。
- 使用“模拟表现分 / 岗位准备度”，不预测录取概率，不暗示真实公司合作，不使用与岗位无关的人口属性评分。

## 3. 技术栈与目录定位

Next.js 14 App Router + React 18 + TypeScript + Tailwind CSS。前后端同仓，后端是 Route Handlers，无独立 Python 服务。大模型使用 OpenAI-compatible `chat/completions`；PDF 使用 `pdfjs-dist`；存储使用内存或 `pg`。

本次本机版本为 Node `v22.17.0`、npm `10.9.2`。**不要沿用 README 的 Node ≥18.17 要求**：锁文件中的 `pdfjs-dist` 要求 `>=22.13.0 || >=24`，建议使用满足该要求的 Node 22 或 24。

```text
src/app/
  layout.tsx / globals.css         全局布局、样式、隐私说明
  page.tsx                        首页
  resume/page.tsx                  简历；新版增加推荐、搜索、JD 导入
  interview/page.tsx               面试、主问题与追问交互
  report/[sessionId]/page.tsx      报告、二次挑战、两轮对比
  records/page.tsx                 训练记录查看和删除
  components/Section.tsx           通用区域组件（不是 src/components）
  components/ScoreBar.tsx          评分条
  api/                            接口，见下一节
src/lib/
  types.ts                        核心类型及全部异步 Store 契约
  api.ts                          ok / fail / ServiceError
  roles/pythonBackendIntern.ts    Python 岗位、阶段、评分规则、题库
  roles/index.ts                  岗位查找；新版包含动态注册
  roles/catalog.ts                [新版] 其余 12 个职业方向
  roles/roleFactory.ts            [新版] 职业方向与 JD 对象生成
  services/roleService.ts         [新版] 推荐、JD 导入、岗位恢复
  services/resumeService.ts       简历分析与规则兜底
  services/interviewService.ts    核心状态机、出题、追问、二次挑战
  services/scoringService.ts      单题评分与固定总分公式
  services/reportService.ts       跨题聚合、报告文案、对比
  services/asrService.ts          可选语音转写
  llm/client.ts                   兼容 API、JSON 提取、失败重试一次
  llm/prompts.ts                  提示词；新版增加推荐和 JD 解析
  llm/validate.ts                 输出结构校验及规则补齐
  store/memoryStore.ts            MemoryStore、StoreFacade、全局单例
  store/postgresStore.ts          PostgreSQL 读写
  parser/pdf.ts                   PDF 文字层提取
  parser/ocr.ts                   [新版] 扫描 PDF 图片提取和视觉识别
  demo/sampleResumes.ts           自制演示数据
src/types/pdf-parse.d.ts           遗留文件名，内容声明 pdfjs-dist
db/schema.sql                    建表；新版含旧会话表增列语句
scripts/                         三模式冒烟、mock 模型、PDF 测试生成器
test-data/                       虚构简历和回答语料
docs/                            方案、部署、进度与开发记忆
```

## 4. 接口与核心调用链

统一成功响应 `{ ok: true, data }`，失败响应 `{ ok: false, message, code? }`，不要假定响应体直接就是业务对象。

| 方法与路径 | 输入 / 职责 |
|---|---|
| `GET /api/health` | 返回配置模式、模型名称、存储类型、ASR 配置状态 |
| `GET /api/roles` | 岗位列表；新版包含持久化恢复的 JD |
| `POST /api/roles/recommend` [新版] | `{ resumeText }`，至少 50 字，推荐最多 5 项 |
| `POST /api/roles/import` [新版] | `{ jobText }`，至少 30 字，返回导入岗位 |
| `POST /api/resume/parse-pdf` [新版] | multipart `file`，最大 15 MiB，返回 `text/fileName/source` |
| `POST /api/resume/analyze` | JSON `{ roleId, resumeText }`，或 multipart `roleId/file`；至少 50 字，截到 20000 字 |
| `POST /api/interview/start` | 首轮 `{ roleId, resumeAnalysisId }`；二轮加 `round: 2, basedOnSessionId`，可继承简历 |
| `POST /api/interview/answer` | `{ sessionId, answer }`；返回 session 和 `followUp/question/completed` 事件 |
| `GET /api/interview/session/:id` | 读取当前会话 |
| `GET /api/report/:sessionId` | 读取缓存或生成报告；会话未完成返回 409 |
| `GET /api/records` | 会话摘要列表 |
| `DELETE /api/records?id=...` | 删除会话、报告及不再被其他会话引用的简历分析 |
| `POST /api/asr` | 可选音频转写；未配置返回 501 |

新版推荐流程：`recommendRoles` → 规则技能匹配 → 模型语义匹配 → 有模型结果时按规则 60% + 模型 40% 混合 → 排序取 5 → 保存推荐及岗位快照。星级阈值为 40/55/70/85，和面试五维总分不是同一个指标。

新版 JD 流程：`importJobPosting` → 模型解析或规则兜底 → `createJobPosting` → 注册动态岗位 → `saveJobPosting`。`getTargetRole` 支持从数据库恢复；纯同步 `getRole` 不能替代该恢复路径。

面试主流程：

1. `analyzeResume` 保存分析；新版同时保存当时的岗位快照。
2. `startSession`：二轮取首轮报告薄弱项 → `buildPlan` 先建题库计划再尝试模型替换 → 保存会话及第一题。
3. `submitAnswer`：首次回答尝试一次追问 → 有追问返回 `followUp`；无追问或已答追问则进入 `advance`。
4. `advance`：`scoreQuestion` → 推进 `currentPlanIndex` → 下一题或 `completed` → 保存会话。
5. `buildReport`：先查缓存 → 聚合维度平均分 → `computeOverall` → 生成或兜底报告文案 → 二轮计算与首轮的 delta → 保存。

新版要保留 `ResumeAnalysis.roleSnapshot`、`InterviewSession.roleSnapshot` 的使用，历史评分不能简单套用当前岗位目录。实际类型名是 `RoleRecommendation`，文档中的 `MatchResult` 不是已定义的同名类型。

## 5. 本地同步、启动与配置

以下是后续操作指南，本次未执行 merge、安装依赖或启动应用。

### Git 检查及同步

```powershell
Set-Location D:\CareerForge
git status --short --branch
git log -5 --oneline
git -c http.proxy=http://127.0.0.1:7897 -c http.sslBackend=openssl fetch origin main
git rev-list --left-right --count HEAD...origin/main
git diff --stat HEAD origin/main
git show 'origin/main:docs/项目接手指南.md'
```

本次直连 GitHub 失败；代理配合默认 Schannel 报 `SEC_E_NO_CREDENTIALS`；使用上述单次 `openssl` 配置成功。没有修改 Git 全局配置，也没有关闭 TLS 校验。代理端口是本机当前条件，换环境需重新确认。

用户要求同步时，先保护本地修改并检查未跟踪文件是否与远端冲突。对本次这种仅落后的分支，可使用 `git merge --ff-only origin/main`；若失败，检查分叉原因，不使用强制重置或清理未跟踪文件。后续新开发默认用 `codex/` 分支；远端旧文档提及 develop 不代表本机当前分支就是 develop。

### 安装和运行（PowerShell）

```powershell
npm ci
# 仅首次创建，避免覆盖已有配置
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
# 默认 http://localhost:3000
```

生产模式先 `npm run build`，构建成功后另行运行 `npm run start -- -p 3210`。`package.json` 没有 `test`、`lint`、`typecheck` 脚本，不要虚构这些命令。

| 变量 | 说明 |
|---|---|
| `OPENAI_API_KEY` | 未配置走规则/题库；不把真实值写入文档、输出或前端 |
| `OPENAI_BASE_URL` | 兼容接口根路径，客户端附加 `/chat/completions` |
| `OPENAI_MODEL` | 默认 `gpt-4o-mini`；新版文档使用千问 `qwen-plus`，由配置决定 |
| `OCR_MODEL` [新版] | 默认 `qwen-vl-plus`，须支持图片输入 |
| `OCR_API_KEY / OCR_BASE_URL` [新版] | 优先用于 OCR，未设时复用普通模型配置 |
| `DATABASE_URL` | 未配为内存；配后还须执行匹配版本的 schema |
| `ASR_API_KEY / ASR_BASE_URL / ASR_MODEL` | 可选语音转写，默认模型 `whisper-1` |

千问兼容根路径示例为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。示例不是强制供应商选择。本次没有读取 `.env.local` 或调用付费模型。

注意 OCR 当前实现首先要求 `getLLMConfig()` 成功，**只配置 OCR_API_KEY 而不配置 OPENAI_API_KEY 不能启用 OCR**。

### 数据库与部署

配置目标数据库后执行对应版本的 `db/schema.sql`。PowerShell 中，若已把连接串配置到当前进程环境且已安装 psql，命令为：

```powershell
psql "$env:DATABASE_URL" -f db/schema.sql
```

`.env.local` 会由 Next.js 加载，但不会自动进入 PowerShell 的 `$env:DATABASE_URL`。也可在 Supabase SQL Editor 执行 schema。

新版新增 `job_postings`、`recommendation_runs`、`role_snapshots`，并给 `interview_sessions` 添加 `role_snapshot`；不能用旧 schema 验证新版持久化。部署路径参考 `docs/部署指南.md`，目标为 Vercel + Supabase/PostgreSQL；本次未验证任何公网部署。

## 6. 测试操作与证据边界

本次是文档任务，只做源码、Git 和文档核验，没有重跑构建、冒烟、真实模型、OCR 或数据库测试。

历史资料报告：旧版兜底 35/35、正常 mock 14/14、乱码 mock 13/13；新版文档报告构建及旧闭环 35/35 通过。这些不代表本次通过，也不证明新增推荐、JD、OCR、快照恢复、真实模型质量已完整覆盖。远端没有修改原有三个 mock/冒烟脚本。

以下各命令在项目根目录执行，先运行 `npm run build` 并确认成功。服务命令会占用终端，应使用不同终端。

### A. 内存与规则兜底

在一个专用 PowerShell 终端显式覆盖可能存在的 `.env.local` 配置；空白字符串会被当前实现视为未配置：

```powershell
$env:OPENAI_API_KEY = ' '
$env:DATABASE_URL = ' '
npm run start -- -p 3210
```

另一个终端：

```powershell
npm run smoke -- http://127.0.0.1:3210
```

### B. 正常 mock 模型

终端一：

```powershell
node scripts/mock-llm.mjs 3999
```

终端二：

```powershell
$env:OPENAI_API_KEY = 'mock'
$env:OPENAI_BASE_URL = 'http://127.0.0.1:3999/v1'
$env:DATABASE_URL = ' '
npm run start -- -p 3211
```

终端三：

```powershell
npm run smoke:llm -- http://127.0.0.1:3211 --expect llm
```

### C. 乱码模型降级

停止终端一的 mock（Ctrl+C），在同一端口重新运行：

```powershell
node scripts/mock-llm.mjs 3999 --garbage
```

保持指向该 mock 的应用运行，执行：

```powershell
npm run smoke:llm -- http://127.0.0.1:3211 --expect fallback
```

结束测试后关闭专用终端和服务，避免测试配置影响后续开发。mock 返回固定评分，只能验证链路，不能证明模型质量。冒烟会创建/删除测试记录，使用隔离的本地环境，不直接对用户生产数据执行。

与变更有关时补充验证：多方向推荐、JD 导入至两轮面试、文本 PDF/扫描 PDF/超大文件、数据库重启恢复、数据库中途故障、桌面与移动端关键页面。不要仅因旧闭环测试通过就宣布这些能力通过。

## 7. 已知实现限制与文档纠偏

- **健康接口不是探活证明**：`/api/health` 的 `mode` 表示 Key 已配置；`store` 起初按连接串设置，数据库首次操作失败后才降为 memory。显示 llm/postgres 不等于外部服务已成功访问。
- **数据库降级不搬运数据**：StoreFacade 首次 PG 异常后在本进程持续走内存；正常 PG 写入不镜像到内存，已有会话可能无法继续。重启后才重新尝试 PG，内存新增数据不会自动回灌。
- **二轮去重并非强保证**：按薄弱标签选题，但没有排除首轮全部题目；不要将“二轮绝不重复”当成已证明事实。报告规则文案写“约 4 题”，实际阶段计划仍为 7 题。
- **证据校验有限**：`validateFollowUp` 校验长度和结构，没有核实引用原文；模型评分证据也需真实质量评估。
- **PDF 路径**：标准字体目录使用正斜杠并以 `/` 结束；旧交接记录生产构建中 `doc.destroy()` 出错，当前实现未调用，恢复该调用前要验证。
- **OCR 仅在特定失败时触发**：新版独立 parse-pdf 接口遇到“未提取到文本”才尝试 OCR；旧 analyze 的 multipart 路径没有同等 OCR 分支。
- **OCR 能力范围**：最多前 8 页、每页最大合格图片，非整页通用渲染；可能遗漏拼接图、混合文字/图片、多栏等内容。文字提取 30 秒、OCR 外层 60 秒超时；`Promise.race` 超时不会自动取消底层所有工作。
- **隐私删除边界**：新版增加的推荐记录和岗位快照没有接入现有会话删除的完整清理；不要宣称删除会话已清除全部衍生数据。
- **认证未实现**：记录接口按 id 操作，没有用户级隔离；多用户生产化需先落实身份与权限。
- **旧说明过时**：本地 README 的 pdf-parse、组件路径和“数据库后续接入”描述不准确；新版文档中的“功能未提交、当前 develop”和部分“待做 UI/OCR”也滞后于提交。
- **规划不是实现**：真实职位 API、DOCX、用户账户、投递管理、推荐历史查询、CI/监控尚未实现；不要将文档百分比视为客观验收数据。

本节是源码核对所得限制及历史注意事项，不代表本次已经复现或修复这些问题。

## 8. 后续开发如何接续

建议先完成版本同步与新版基线验证，再依据用户目标选择一项工作：

1. 稳定性：验证 PostgreSQL 六表读写、重启恢复、删除边界与中途降级行为。
2. 解析质量：使用授权或自制扫描简历验证 OCR，记录准确率、耗时和失败路径。
3. 训练质量：真实模型下评估追问引用、评分证据、两轮选题和对比，不用 mock 分数代替质量指标。
4. 演示体验：验证现有新版页面的加载、错误、空态及移动端表现，避免重复实现已经存在的 UI。
5. 参赛证据：按方案建立固定题库基线与上下文训练的对比实验，实测后填写结果。

这只是接续建议，不要求 agent 自动开始上述工作。新的功能任务先确定验收标准，开发后在此记录实际变更与测试。

## 9. 本地文件保护及更新记录

本次开始前存在的 7 个未跟踪文件：

```text
test-data/dummy.pdf
test-data/gen-pdf.mjs
test-data/gen_pdf.py
test-data/gen_pdf_node.mjs
test-data/gen_real_pdf.mjs
test-data/real-resume.pdf
test-data/upload-test.pdf
```

它们未纳入 Git，本次没有删除、改写或加入版本控制。不能仅凭文件名判断真实简历是否可公开。`scripts/gen-test-pdf.cjs` 生成的 `test-data/sample-compressed.pdf` 是另一文件，新版已忽略；标准 Helvetica/latin1 测试 PDF 不适合中文样本。

### 后续维护格式

每次相关开发结束，更新以下信息即可，避免堆积未经核实的结论：

- 日期、工作分支、HEAD 与已核对的远端提交。
- 用户本次目标、变更文件和行为变化。
- 实际执行的验证命令、结果和使用模式；未验证项单列。
- 剩余问题、明确阻塞与下一步；不记录任何真实密钥或简历正文。

### 2026-09-22 本次记录

已阅读桌面交接、原始方案、部署说明、新版三份项目文档，并核对关键服务、接口、模型、存储与 PDF/OCR 实现。通过代理和 OpenSSL 获取远端 main，仅更新远端引用。本地 HEAD 保持 `4007a61`，新增根目录 `AGENTS.md` 和本文件作为后续开发入口。未执行业务修改、合并、提交、推送或部署。

### 2026-09-22 阶段 0 执行记录（历史）

- 用户要求按开发路线开始执行，本次完成阶段 0 的本地基线。创建 `codex/baseline-validation` 并快进至已核实的 `origin/main`：`985e13a`，新版源码现已在工作区；没有再次 fetch。原有文档、7 个未跟踪测试材料及 `.env.local` 保留。
- 新增 `scripts/smoke-baseline.mjs` 和 `docs/阶段0基线验收记录.md`；修正 README 的 Node 要求、安装与 mock 命令、`.env.example` 的数据库注释。未改业务逻辑，改动尚未提交；HEAD 仍为 `985e13a`。
- 本次实际执行：`npm run build` 成功；规则冒烟 35/35、正常 mock 14/14、异常 mock 13/13、新版接口基线 20/20。后者覆盖推荐、JD 两轮训练、岗位快照、会话读取、页面 HTTP 和文本 PDF/上传异常。
- 本机 npm 入口丢失 `--expect`，异常模式第一次误判 4 项；使用 `node scripts/smoke-llm.mjs <url> --expect fallback` 后通过。后续直接用 node 传递该参数。
- 使用已有依赖与隔离内存服务，未调用真实模型或数据库。真实 OCR、PostgreSQL、浏览器交互和窄屏布局未验收；不能将 HTTP 状态检查表述为 UI 验收。
- 详细启动方法、问题优先级和证据见阶段 0 记录。下一项是阶段 1 的重复提交、旧请求及并发复现和防护。

### 2026-09-22 阶段 1 提交状态加固（历史）

- 基于 `985e13a`，仍在 `codex/baseline-validation`，尚未提交。用户要求继续，本次完成回答提交防重与状态显示，未完成整个阶段 1。
- 回答接口新增必填 `questionId`（主问题或追问 ID）；相同已接收回答重试返回当前会话，不同旧回答返回 409，缺少 ID 返回 422。旧页面需刷新，外部调用需升级。
- Store 增加异步 `updateSession(s, previousQuestions)`：内存复制会话并比较原状态；PostgreSQL 单条条件 UPDATE，无 schema 变化。数据库条件更新异常返回 503，不切内存重写；其余存储降级旧限制仍存在。
- 前端加即时提交锁、冲突恢复入口、保留失败输入，进度改用 currentPlanIndex；实际浏览器确认双标签页冲突、保留输入、加载最新追问和刷新恢复。等待追问时不提前增加完成题数。
- 修复前新回归确实复现重试误答追问；修复后状态回归在规则和正常 mock 各 6 组通过。旧闭环 35/35、新版 20/20、正常 mock 14/14、异常 mock 13/13；最终构建与差异检查通过。
- 验收详情见 `docs/阶段1提交状态验收记录.md`。真实 PostgreSQL 并发、网络故障 UI 注入、窄屏未验证；并发可能产生重复模型调用但不会重复保存。下一项为二轮去重与训练目标/题数说明一致性。

### 2026-09-22 连续开发与最终本地回归（最新）

- 用户持续授权推进路线，明确选择多人登录和数据隔离，并采用训练删除、共享简历清理、推荐单独清空及保留导入 JD 的规则。分支仍为 `codex/baseline-validation`，HEAD `985e13a`；新增代码、测试和文档均尚未提交、推送或部署。
- 二轮按文本优先选择未问题；评分排除面试官文字污染；模型引用验证来源，异常逐维或整体降级。报告展示问题与证据、两轮评分来源及尺度限制。Python、前端、数据分析具有专业题库，其他方向仍主要为通用模板。
- 全部业务接口通过 `src/lib/auth.ts` 验证身份，内存与 PostgreSQL 按 owner 隔离；新增 `/login`、`/api/auth`。生产默认认证，只有显式 `AUTH_MODE=local-demo` 可离线演示。认证采用 Supabase Auth REST；Cookie 最长一小时，到期重新登录。限流为进程级，退出只清本浏览器 Cookie。
- PostgreSQL 故障现在统一返回 503，不再切内存。`db/schema.sql` 六表增加 owner_id 与 RLS；旧 NULL 数据不可见，不自动归属。简历/会话/推荐与快照事务保存；删除清专属快照、无引用简历，删除首轮清二轮对比。推荐历史独立页面/API，清空保留 JD。
- JD 先预览修正再保存，编辑简历使旧分析失效。两个 PDF 入口统一解析，独立 OCR 配置生效，释放与取消解析任务；新增有大小及解压限制的 DOCX 正文/表格提取。记录筛选、确认删除、报告打印样式已实现。
- Next.js 升至 15.5.25，动态路由 params 为 Promise；新增 mammoth，开发测试用 PGlite，定向覆盖 Next 内部 PostCSS。Node 建议 22.13+。完整入口：先 `npm run build`，再 `node scripts/check.mjs`；CI 工作流已写但未远端执行。
- 在最新快照事务代码上重新运行：构建成功；统一检查成功，包含核心 6 组、PostgreSQL 引擎的 schema 重复执行/隔离/CAS/删除/失败回滚、规则 35/35、基线 23/23、状态 6 组、DOCX、正常 mock 14/14、乱码 mock 13/13、两用户认证隔离。`npm audit --cache "$env:TEMP/careerforge-npm-cache"` 为 0 漏洞。
- 浏览器已验本地认证桩登录退出、JD 修正保存、局部 390px 控件；二轮报告可见问题、证据及来源，桌面首屏布局正常。内置浏览器点击打印没有显示预览，打印分页未验收；不声称完整移动端验收。
- `.env.local` 未覆盖，原有 7 个测试文件保留。缺少真实 Supabase、数据库、模型与 OCR 配置；目标环境 RLS/故障恢复、真实评分与 OCR 质量、完整移动端和打印分页仍待验收。PGlite 与 mock 不能替代这些结果。详细接口和发布前清单见 `docs/连续开发验收记录.md`。

### 2026-09-22 浏览器同源修复与窄屏闭环

- 390px 浏览器真实提交复现：从 `127.0.0.1` 访问时，Next.js 的请求 URL 主机被规范化为 localhost，同源 POST 被误拒绝 403。`checkOrigin` 现使用实际 Host 与请求协议比较 Origin，仍拒绝外站。登录 Cookie 的本地判断同步使用 Host，避免公网 Host 被误认为本地而缺少 Secure。
- 认证回归现在携带真实 Origin；通过原生 HTTP 请求验证公网 Host 登录 Cookie 含 Secure（Node fetch 不保留测试所需的 Host 覆盖，故该项使用 http.request）。最新 `npm run build`、`node scripts/check.mjs`、`git diff --check` 通过。
- 浏览器 390×844、规则/内存模式、虚构数据：输入简历→推荐→分析→首轮七题→报告→二轮→短回答触发追问→刷新恢复追问→完成二轮→对比报告→两条已完成记录，均通过页面操作完成；面试、报告、记录首屏截图无明显横向溢出。不代表真机键盘、全部浏览器和真实服务验收。
- 打印预览仍受当前内置浏览器能力限制，未宣称分页通过。外部服务配置阻塞不变。HEAD 仍为 985e13a，未提交或部署。

### 2026-09-22 追问证据关联修复

- 下一步按报告质量推进。先以“主回答仅说我做过接口，追问补充职责和120ms结果”编写失败回归，确认原规则评分使用追问内容却只展示主回答片段。
- 规则证据现在分别标注主回答、追问回答，每段最多160字符并明确省略号；合并来源不再声称只有一个 evidenceSourceId，同时记录主问题和已回答追问。模型引用追问时，报告通过来源ID匹配实际追问文本，而不是其主问题。删除报告证据列表中重复包裹的引号。评分公式不变。
- 新增服务到报告的关联回归；最新 npm run build、node scripts/check.mjs、git diff --check 通过。已有缓存报告不自动重算，新生成报告采用新逻辑；片段仍是摘要，不代表完整评分解释。
- HEAD 985e13a，未提交或部署。后续重点仍是报告打印/表单与键盘细节，以及配置真实服务后的多人和模型质量验收。

### 2026-09-22 报告保存与删除竞态

- 用户要求继续投入代码与架构可靠性。先复现：删除首轮后，延迟二轮报告保存会重新写入已删除首轮的对比证据；内存保存报告也未检查会话是否已删。
- MemoryStore 保存报告时核对当前会话、复制报告并剔除失效比较；PostgresStore 保存报告改用事务，对当前会话及比较基准会话按 ID 加行锁，核对 owner 和 based_on_session_id 后写入。会话不存在返回404，StoreFacade保留业务错误；报告服务返回实际存储结果，避免返回已被剔除的旧比较。
- 新增服务层交错测试：暂停模型文案返回→删除训练→释放模型结果，确认404且没有报告复活。内存与 PGlite 同时覆盖删除基准后迟到写入、删除当前会话后迟到写入。PGlite未模拟多连接行锁竞争，目标数据库并发仍需验收。
- 最新 npm run build、node scripts/check.mjs、git diff --check 全部通过。未改 schema，无新依赖。HEAD仍985e13a，未提交/推送/部署。
- 后续可继续：统一登录过期恢复、慢请求取消与重复模型调用控制、长文本打印布局。共享限流等待部署规模确定；真实认证/数据库/RLS/模型/OCR配置阻塞不变。

### 2026-09-22 统一登录恢复

- 新增 useAuthRecovery，简历、面试、报告、记录、推荐历史五页业务请求收到401才显示独立登录入口。恢复只重新加载读取请求，提交/启动/删除不自动重放；页面输入保留，重新获取岗位时保留仍有效的选择。
- /login?recovery=1 登录成功后提示返回原页；普通登录保持跳转记录页。面试恢复会重新读取当前问题、解除旧状态并提示核对保留回答。未实现自动刷新令牌或持久草稿。
- 浏览器用本地认证桩实际验证：未登录简历页填写虚构简历→新页面登录→原页重新加载，输入保留、岗位列表恢复。其他页面完成构建检查和原有API回归，未声称全部页面的过期交互已逐一浏览器验收。
- 最终 npm run build、node scripts/check.mjs、git diff --check 通过。临时服务和浏览器页面清理。HEAD 985e13a，未提交/推送/部署。

### 2026-09-22 重复模型调用与超时预算

- 新增进程内 pendingWork：按当前用户 Store 实例隔离，复用相同会话/问题/规范化回答的在途提交，以及相同会话的报告生成。成功或失败立即移除任务；不持久缓存回答正文。不同回答仍由原有条件更新处理冲突。
- 模型两次尝试共用默认30秒预算（含响应体读取），不再每次重试重置30秒；超时按原规则降级。单个业务请求可能依次执行追问和评分，因此不承诺整个请求最多30秒。
- 测试实际计数：并发相同回答仅一次追问模型调用，并发报告仅一次文案调用；覆盖用户隔离、失败后重试和两次尝试同一超时信号。node scripts/test-core.cjs、npx tsc --noEmit、git diff --check通过。
- 用户正在查看3210演示，因此本轮未重建其.next产物或重启服务，未声称本轮生产构建/完整HTTP回归通过；运行中的演示仍为此前构建。后续可在用户结束演示后统一构建回归。
- 任务复用仅限同一Node进程，不提供跨实例去重；浏览器断开不取消共享任务，以免影响其他等待请求；上游超时中止不保证模型提供商不计费。HEAD985e13a，未提交或部署。

### 2026-09-22 持续完善：隔离验收、表单竞态与简历证据

- 为避免修改用户正在浏览的3210演示构建，将源码复制到忽略的 `.validation/`，复用依赖；同盘独立构建成功。最初跨盘临时副本因Webpack依赖路径失败，未当作业务失败。未复制.env.local和用户样本。
- `scripts/check.mjs [basePort]` 支持独立端口（本次3310–3313），启动前检查所有测试端口，避免误连已有服务；增加模型/认证桩就绪等待和失败时子进程日志。实际验证3210被占用时退出且未开始测试。
- 简历页请求期间通过fieldset锁定输入、岗位和JD，防止旧模型结果覆盖请求中途的新编辑；完成/失败释放。新增表单可访问名称，面试回答限制5000字符且显示计数，等待文案区分推荐与分析。8秒延迟mock浏览器确认简历和岗位不可编辑，响应后恢复并显示分析结果。
- 简历缺口模型证据现在必须出现在简历原文；无效项丢弃，全部无效时使用规则缺口。新增真实引用通过、虚构引用降级回归。该检查不验证没有显式引用的推断，也不保证模型分析正确。
- 最新源码在.validation生产构建成功，完整check 3310通过（规则35、基线23、模型14/13、状态/DOCX/认证/核心/SQL）。一次认证503复跑通过，原因未确定；补就绪等待后再次整套通过。TypeScript与diff检查通过。后续仅脚本失败日志和文档修改，无业务变更。
- 演示3210保持原构建和内存数据；本次改动尚未替换演示。真实认证/数据库/RLS/模型/OCR、真机与打印分页仍未验收；无凭据或支持的打印预览能力，无法以mock代替。HEAD985e13a，未提交/部署。

### 2026-09-22 对照原始MVP补齐报告

- 对照《AI求职实训教练项目方案》3.5与3.6，发现报告缺少当次简历匹配摘要、两轮比较已有improved/remaining未展示。本轮补齐这两项，而不是扩张新岗位。
- ReviewReport新增可选resumeSummary，只保存匹配分、匹配技能、缺口和来源，不复制完整简历正文；旧缓存报告显示未保存摘要。报告说明简历分不计入面试分。二轮显示维度至少上升0.3分项和低于60%项，不宣称问题已解决。
- 服务回归验证摘要字段与不包含简历正文。独立.validation构建通过；TypeScript检查通过。未替换3210演示构建，未提交/部署。原始闭环主要功能具备，但真实模型质量、数据库/认证验收、OCR与打印仍不能标完成。


## 2026-09-22：面试强度与语音输入

基于分支 codex/baseline-validation、HEAD 985e13a 的未提交改动。新增主问题数量 5/7/9、基础/标准/进阶、每题追问上限 0/1/2；总结题不追问。二轮继承首轮设置，设置保存到会话与报告。难度通过出题要求调整，尚非人工校准的难度量表。

浏览器支持点击录音、停止转写、编辑预览、确认追加，最长120秒、10 MiB；不会自动提交回答。追加超过5000字符时保留预览。未配置ASR时提示文字输入，切题释放设备并取消请求。未验证真实麦克风与真实ASR效果；尚未实现实时识别、音量/静音检测、时长设置、题型比例、数字人或联网岗位采集。

数据库须执行 db/schema.sql 新增的 interview_sessions.settings JSONB 迁移，旧会话按默认设置读取。ASR使用兼容 /audio/transcriptions 的服务。已通过配置完整训练HTTP回归、13岗位题数检查、配置持久化和ASR协议/输入校验；实际设备测试仍待完成。新版预览为 http://localhost:3314/resume（内存演示）。收尾曾误在根目录构建，3210进程未停止但旧资源可能受影响，使用3314验收。


## 2026-09-23：真实岗位来源与受控采集

本轮在 codex/baseline-validation / HEAD 985e13a 上继续开发，未提交或部署。新增 POST /api/roles/collect，仅接受 Greenhouse 官方公开单岗位页面链接，通过固定 boards-api.greenhouse.io GET 读取，不运行网页脚本、不跟随跳转、不访问正文链接、不向来源发送简历。公网IPv4校验并绑定TLS连接，10秒业务超时、512 KiB响应限制、最多3个在途请求、每用户6次/分钟及每进程30次/分钟。限流和签名密钥均为进程内实现，多实例需共享设施。

采集后仍需预览确认才保存。正文进行HTML清理与有限联系方式脱敏，非网页完整原文；来源记录保存URL、可用时的官方公司名、时间、正文SHA-256及unknown招聘有效性。采集凭据由服务端签名、绑定正文且30分钟过期；编辑正文/来源/公司降为手工导入，重启后需重新采集。不信任客户端自称接口来源。训练要求单独标记自动提取或用户确认，来源标识不证明提取结果准确。快照和报告继承来源，存于既有JSON payload，无本轮数据库新列。

真实GitLab AI Engineer和Ruby Backend Engineer公开岗位已取得，访问证据和技能短摘录在 test-data/jobs/gitlab-public-samples.json，验收标准在 docs/真实岗位数据验收.md。它们是同公司英文调试样本，不代表国内校招或独立质量验收。修复英文岗位标题、技能词边界、必备/加分分节和任选条款保留；规则仍需人工核对，不是完整语义解析。所有模型请求增加不可信资料指令边界，模型无采集/执行工具权限；这不保证语义提示注入完全消除。

新版独立构建位于忽略的 .validation/jobs-preview/，没有复制.env.local或用户真实样本。预览 http://localhost:3324/resume ，原3314与3210服务未停止。生产构建及完整回归 check 3320通过；包含新增安全/来源/真实摘录解析/PGlite快照测试。测试修复：来源闭环虚构简历不足50字；mock按泛化“评分”匹配误认新增安全提示，现按“评分模块”分流。浏览器已真实采集GitLab岗位、预览并确认保存，验证跨API签名及来源展示。真实模型语义质量、多实例部署、国内数据源授权、自动失效核验、岗位撤回/清理入口仍未完成。

收尾验证（2026-09-23）：修复明确语言任选条件的关键词匹配后，最终生产构建、完整check 3320和差异检查通过。再次调用真实GitLab岗位接口并预览/确认/分析，断言Python匹配任选项、REST和GraphQL独立、GitLab不因公司介绍进入必备；全部通过。最终3324预览保留已导入的AI Engineer，使用虚构简历验收，无真实用户简历出站；内存数据重启即清空。
