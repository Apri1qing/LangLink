# Active Context

## 当前工作焦点

2026-04-29：建立项目级 agent harness 与 agentic-engineering 工作流沉淀，支持未来用 subagent-driven-development 拆分 TravelTalk 的前端、Edge Functions、数据、测试与发布任务。

## 本次新增方向

- 补齐 Memory Bank 核心文件，作为每次任务启动的上下文入口。
- 建立 [docs/agent-harness.md](../docs/agent-harness.md)，定义 action space、observation、错误恢复、上下文预算与验证契约。
- 建立 [docs/agentic-workflow.md](../docs/agentic-workflow.md)，定义评估优先循环、15 分钟任务单元、模型路由和成本纪律。
- 建立 [docs/subagent-development-plan.md](../docs/subagent-development-plan.md)，按项目模块规划可交给 subagent 的独立工作包与评审门槛。

## 活动决策

- 文档沉淀优先，不改业务代码。
- subagent 规划先做任务边界和验收标准，不在没有具体实施计划时启动多个实现 subagent。
- 对 voice/image/phrase/history/PWA 等模块，先定义基线评估，再实施功能或重构。

## 下一步建议

- 将 `docs/test-plan.md` 从 v1.3 更新到 v1.4，删除已回滚的单 pill / auto 检测用例，补齐双 pill 与图片覆盖层用例。
- 为 `voice-translate` NDJSON 协议补充 contract tests 或 fixture。
- 为前端核心服务与 store 建立回归测试清单。

