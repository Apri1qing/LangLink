# Tech Context

## 技术栈

- 前端：React 19、Vite、TypeScript、Tailwind CSS、PWA。
- 状态管理：Zustand。
- 本地存储：Dexie / IndexedDB。
- 测试：Vitest、Testing Library、Playwright。
- 后端：Supabase Edge Functions，TypeScript / Deno。
- 数据库：Supabase PostgreSQL。
- AI 服务：阿里云 Gummy、qwen-vl OCR、qwen3-tts-flash、自有 OpenAI-compatible LLM API。

## 常用命令

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run test
```

```bash
supabase start
supabase functions serve
supabase functions serve voice-translate
supabase db reset
```

## 版本注意

- 根 README 仍写 React 18，但 `CLAUDE.md` 与 `frontend/package.json` 显示 React 19，应以实际依赖与 CLAUDE.md 为准，后续可单独修正 README。
- 当前项目不是 Maven 项目；修改后不运行 `mvn validate`，应按前端/后端变更运行对应 npm 或 supabase 验证。

## 终端要求

- agent terminal 命令前加载 `source ~/.zshrc`。
- 若 `.zshrc` 在沙箱内尝试写 Home 缓存失败，只要后续命令正常执行即可记录为环境噪声。

## Context7 使用约束

涉及库/API 文档、代码生成、安装或配置步骤时，使用 Context7 MCP 获取当前官方文档上下文；纯项目内文档沉淀不需要外部文档。

