# TravelTalk

旅行翻译工具 - 语音 + 图片 + 常用语

## 技术栈

- **前端**：React 18 + Vite + TypeScript + Tailwind CSS + PWA
- **后端**：Supabase Edge Functions (TypeScript/Deno)
- **数据库**：Supabase PostgreSQL
- **AI 服务**：阿里云 (ASR/TTS/OCR) + 自有 LLM API

## 项目结构

```
travelingAssistant/
├── frontend/          # React PWA 前端
├── supabase/          # Supabase 后端
│   ├── functions/     # Edge Functions
│   └── migrations/    # 数据库迁移
└── docs/              # 文档
```

## 开发

### 前端
```bash
cd frontend
npm install
npm run dev
```

### 后端 (Supabase)
```bash
supabase init
supabase start
supabase functions serve
```

## 文档

- [产品需求文档](./prd.md)
- [技术设计文档](./docs/tech-design.md)

## Git 工作流

参考 [提交规范](./docs/git-workflow.md)，小步提交、分阶段开发。

## 开发阶段

- [ ] 阶段一：基础架构搭建
- [ ] 阶段二：数据库设计 + 限流中间件
- [ ] 阶段三：LLM 多 API 轮询网关
- [ ] 阶段四：语音翻译全链路
- [ ] 阶段五：图片翻译全链路
- [ ] 阶段六：常用语 + 本地存储
- [ ] 阶段七：PWA 优化 + 上线
