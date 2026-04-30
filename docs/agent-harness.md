# TravelTalk Agent Harness

## 目标

本 harness 用于约束 AI agent 在 TravelTalk 项目中的计划、工具调用、错误恢复、验证与交付方式。它不是业务代码框架，而是让后续 AI 执行更稳定的工程作业协议。

## 启动协议

每次任务开始必须读取：

1. `memory-bank/projectbrief.md`
2. `memory-bank/productContext.md`
3. `memory-bank/systemPatterns.md`
4. `memory-bank/techContext.md`
5. `memory-bank/activeContext.md`
6. `memory-bank/progress.md`
7. 任务相关文档，例如 `docs/prd.md`、`docs/tech-design.md`、`docs/test-plan.md`

如果 Memory Bank 缺失，应先补齐或说明缺口。

## Action Space

| 动作类型 | 粒度 | 适用场景 | 质量门 |
|---|---:|---|---|
| read_context | medium | 读取 Memory Bank、README、CLAUDE、目标模块 | 输出上下文摘要和冲突点 |
| inspect_code | medium | 搜索调用链、类型、测试、配置 | 标明关键文件与行号 |
| edit_doc | medium | 修改 Memory Bank、计划、测试文档 | 文档与事实源一致 |
| edit_frontend | medium | React、hooks、store、services、测试 | `npm run lint`、`npm run test`、必要时 `npm run build` |
| edit_edge_function | medium | Supabase Edge Functions | 本地 serve 或可替代 contract test |
| edit_migration | micro | 数据库迁移 | 迁移审查、回滚说明、`supabase db reset` 可行性 |
| deploy | micro | 发布 Edge Function 或前端 | 明确环境、版本、回滚路径 |
| verify | medium | 构建、测试、截图、手动验证 | 记录命令、结果、剩余风险 |

## Observation Contract

所有脚本、subagent 汇报、评审结果尽量使用以下结构：

```json
{
  "status": "success | warning | error",
  "summary": "一句话说明结果",
  "next_actions": ["下一步动作"],
  "artifacts": ["相关文件、命令、截图、日志或提交"]
}
```

若是错误结果，必须额外包含：

```json
{
  "root_cause_hint": "最可能原因",
  "safe_retry": "可以安全重试的方式",
  "stop_condition": "什么时候不要继续自动重试"
}
```

## Recovery Contract

| 错误类型 | 根因提示 | 安全重试 | 停止条件 |
|---|---|---|---|
| 测试失败 | 断言过期、行为回归、环境缺失 | 先读失败用例，再做最小修复 | 同一错误连续 2 次无新信息 |
| 类型失败 | 类型定义和实现不一致 | 从共享类型或服务边界修复 | 需要改变公开协议但没有产品确认 |
| Edge 外部服务失败 | 密钥、网络、DashScope/Supabase 环境 | 用 mock/fixture 验证本地逻辑 | 涉及真实付费调用或生产配置 |
| 迁移失败 | schema 冲突或数据不兼容 | 本地重置数据库验证 | 会破坏用户数据且无回滚方案 |
| E2E 失败 | 设备权限、视口、真实服务不稳定 | 用专用 Chrome 脚本和固定视口重跑 | 失败依赖不可控第三方服务 |

## Context Budget

- 系统级规则保持短小，项目细节放 Memory Bank。
- 大段 API 文档不内联，涉及库/API 时通过 Context7 查询。
- 阶段结束后更新 `activeContext.md` 与 `progress.md`。
- 不在主动调试中随意压缩上下文；在完成一个里程碑后压缩。

## Completion Checklist

每个实现任务完成前至少回答：

- 完成标准是否在执行前定义过？
- 是否只修改了任务相关文件？
- 是否更新了必要文档或 Memory Bank？
- 是否运行了与改动对应的验证？
- 如果验证没跑，原因和剩余风险是什么？
- 是否记录了下一步和可回滚边界？

