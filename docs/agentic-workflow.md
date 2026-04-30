# TravelTalk Agentic Engineering Workflow

## 工作流原则

TravelTalk 的 AI 工程流程采用评估优先、任务分解、模型路由、双阶段评审的方式。目标是让 AI 负责大量实现工作，人类保留需求、质量和上线风险控制权。

## 评估优先循环

1. 定义完成标准。
2. 选择能力评估和回归评估。
3. 运行基线，记录失败特征。
4. 执行实现或重构。
5. 重新运行评估，比较差异。
6. 更新 Memory Bank 与相关计划。

## 默认验证矩阵

| 改动区域 | 最小验证 | 扩展验证 |
|---|---|---|
| 前端组件/UI | `cd frontend && npm run lint` | `npm run test`、`npm run build`、移动视口截图 |
| hooks/store/services | `cd frontend && npm run test` | `npm run build`、关键交互 E2E |
| Edge Functions | contract test 或本地 serve smoke test | Supabase 本地联调、真实服务小样本验证 |
| 数据库迁移 | migration review | `supabase db reset` |
| 文档/计划 | 链接与事实一致性检查 | 与 PRD/tech-design/test-plan 交叉校验 |

当前项目不是 Maven 项目，修改后不运行 `mvn validate`。

## 15 分钟任务单元模板

每个任务单元必须能独立验证，并只有一个主要风险。

```markdown
### Task: <名称>

- Scope: <文件/模块边界>
- Done: <可观察完成条件>
- Main risk: <一个主要风险>
- Baseline eval: <改动前要跑什么>
- Regression eval: <改动后要跑什么>
- Rollback: <如何回退或关闭>
```

## 模型路由建议

| 任务 | 推荐层级 | 原因 |
|---|---|---|
| 文档归纳、测试计划整理、窄范围样板编辑 | Haiku | 低推理、低风险、结构化输出 |
| 组件实现、hook/store/service 重构、测试修复 | Sonnet | 需要稳定代码编辑和局部推理 |
| 语音链路根因分析、协议不变量、跨前后端架构决策 | Opus | 多文件不变量和复杂故障分析 |

## 成本纪律

每个任务记录：

- 模型层级。
- 预计与实际耗时。
- 重试次数。
- 运行的评估。
- 成功/失败。
- 失败原因分类。

只有当低层级模型失败且能指出明确推理缺口时，才升级模型层级。

## 审查重点

AI 生成代码优先审查：

- 语音与图片协议不变量。
- 错误边界和重试行为。
- 鉴权、密钥、用户配额假设。
- 历史会话与本地缓存的隐藏耦合。
- 移动端交互、权限与浏览器兼容性。

不把已由 ESLint/TypeScript/formatter 覆盖的纯风格争论作为主要审查内容。

