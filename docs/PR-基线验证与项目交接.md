# PR：基线验证、多人试用加固与项目交接

## 变更摘要

本分支将 CareerForge 从单机 MVP 基线推进到可继续验收的多人试用准备版本，补齐了认证隔离、状态一致性、输入解析、报告可靠性、岗位来源追溯和统一回归工具，并提交了完整的项目交接材料。

主要范围：

- 增加 Supabase Auth、HttpOnly Cookie、业务 API 身份校验和用户数据隔离。
- 加固面试状态机：问题 ID 校验、重复提交保护、刷新恢复、二轮题目去重和可配置面试强度。
- 增加 PDF、OCR、DOCX 解析路径，并保留可编辑输入和失败降级。
- 增加推荐历史、岗位快照、训练删除语义、报告竞态保护和证据来源关联。
- 增加 ASR 语音输入入口，未配置服务时回退到文字输入。
- 增加 Greenhouse 官方公开岗位的受控采集、预览确认和来源追溯。
- 增加统一回归脚本、认证桩、模型桩、PGlite 数据库契约检查及真实岗位样本。
- 更新 `AGENTS.md`、`docs/AGENT_MEMORY.md`、验收记录和部署说明，方便后续参与者接手。

## 验证结果

已在 Node `22.17.0`、npm `10.9.2` 环境完成：

- `npm run build`
- `node scripts/check.mjs 3320`
- `npx tsc --noEmit`
- `git diff --check`
- `npm audit`：0 vulnerabilities
- 浏览器验证登录恢复、JD 预览确认、面试设置、Greenhouse 岗位采集、报告来源和 390px 核心闭环

统一回归覆盖规则模式、正常模型桩、异常模型桩、状态机、认证隔离、DOCX、PGlite 事务与岗位来源校验。

## 已知限制

- 尚未配置真实 Supabase、PostgreSQL、模型、OCR 或 ASR 服务。
- 真实模型质量、真实账号/RLS、云端重启恢复、真机语音和 OCR 质量仍待目标环境验收。
- 打印分页和完整跨浏览器移动端验收尚未完成。
- 岗位采集目前只支持 Greenhouse；限流和签名仍是进程内实现。

## CI 状态与解决方案

`.github/workflows/check.yml` 已在本地完成 review，但没有包含在本次远端分支中。当前 GitHub OAuth 凭据缺少 `workflow` scope，推送该文件时会被 GitHub 拒绝；本机 `gh auth status` 同时显示保存的登录令牌已失效。

重新授权后执行：

```powershell
gh auth login -h github.com -p https -w -s workflow
git add .github/workflows/check.yml
git commit -m "ci: add local regression workflow"
git -c http.proxy=http://127.0.0.1:7897 -c http.sslBackend=openssl push
```

如果使用 fine-grained PAT，需要给该仓库授予 Actions workflow 写权限。CI 文件只负责在 push/PR 时运行 `npm ci`、`npm run build` 和 `node scripts/check.mjs`，不影响本地运行和生产应用。

## 提交与分支

- 分支：`codex/baseline-validation`
- 基线提交：`3b2cdae`
- 交接状态提交：`b79ca36`
- 远端：`origin/codex/baseline-validation`
