# TravelTalk Agent Guide

## Always

- 始终中文回复。
- 每次任务开始读取 `memory-bank/` 全部核心文件。
- terminal 命令前加载 `source ~/.zshrc`。
- 涉及库/API 文档、代码生成、安装或配置步骤时使用 Context7 MCP。
- 修改前优先读 `CLAUDE.md`、`docs/prd.md`、`docs/tech-design.md` 与目标模块。

## Project Facts

- 实际前端依赖以 `frontend/package.json` 和 `CLAUDE.md` 为准：React 19、Vite、TypeScript、Tailwind、Zustand、Dexie。
- 根 README 的 React 18 描述可能过期。
- 当前不是 Maven 项目；前端变更运行 npm 验证，Supabase 变更运行对应本地验证。
- `docs/test-plan.md` 仍偏 v1.3，后续应更新到 v1.4。

## Agent Harness

- 使用 `docs/agent-harness.md` 作为任务执行契约。
- 使用 `docs/agentic-workflow.md` 作为评估优先与模型路由流程。
- 使用 `docs/subagent-development-plan.md` 规划 subagent 任务边界。
- 高风险操作拆小：部署、迁移、密钥、生产数据、删除操作。

## Review Priorities

- 协议不变量：voice NDJSON、image regions、phrase cache、session message。
- 错误恢复：网络、麦克风、外部 AI 服务、空 OCR、无语音。
- 移动端体验：390x844 视口、触摸手势、权限弹窗、PWA。
- 安全边界：API Key 只在 Edge，前端不直连 DashScope。

