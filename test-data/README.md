# 测试语料集（方案 8.1）

> 全部为**自制虚构数据**，用于内部测试简历分析与评分链路，不涉及任何真实个人信息。
> 文件命名：`resume-<编号>-<水平>.txt`，水平分三档：weak（空泛）/ medium（部分具体）/ strong（量化完整）。

| 编号 | 水平 | 预期表现 |
|---|---|---|
| resume-01 | weak | 匹配分低，多条空泛表述，建议补齐必备技能 |
| resume-02 | weak | 技能词全缺失，缺口最多 |
| resume-03 | weak | 有项目但零量化 |
| resume-04 | medium | 技能覆盖一半，项目描述半具体 |
| resume-05 | medium | 有量化但技术栈偏离岗位 |
| resume-06 | medium | 技能齐全但项目空泛 |
| resume-07 | strong | 高匹配，量化充分 |
| resume-08 | strong | 高匹配，含加分技能（Redis/Docker/pytest） |
| resume-09 | weak（超短） | 触发"简历过短"校验（<50 字） |
| resume-10 | medium（跨方向） | 前端方向简历，验证岗位相关性评分 |

## 回答语料（answers-categorized.md，30 条）

- vague（空泛，10 条）：应触发追问 + 低分
- off-topic（答非所问，10 条）：岗位相关性/表达结构低分
- specific（具体含量化，10 条）：不应触发规则追问 + 高分

## 使用方式

```bash
# 启动服务后逐份提交
node scripts/smoke.mjs http://127.0.0.1:3000   # 基础闭环
# 或在 /resume 页面手动粘贴各份简历观察分析差异
```
