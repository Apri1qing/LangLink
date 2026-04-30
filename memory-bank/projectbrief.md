# Project Brief

## 项目名称

TravelTalk

## 项目目标

TravelTalk 是一个面向出境旅行场景的极简翻译 PWA，围绕「语音翻译、图片翻译、常用语」提供快速沟通能力。MVP 聚焦中文与日文的双向沟通，同时保留多语言扩展能力。

## 核心范围

- 语音翻译：浏览器采集音频，经 Supabase Edge Function 连接阿里云 Gummy，返回流式识别与翻译结果，并生成 TTS。
- 图片翻译：拍照后进行 OCR 与翻译，将译文按 OCR 区域叠加在照片上。
- 常用语：本地 IndexedDB/Dexie 存储，支持多目标语言 lazy 缓存。
- 历史会话：跨拍照模式与 Voice Mode 记录翻译消息，便于继续对话。
- PWA：面向移动端旅行使用，强调单页、低摩擦、弱网下基础可用。

## 非目标

- 不在浏览器暴露 DashScope 或 LLM API Key。
- 不把完整 AI 服务调用直接放到前端。
- 不为 MVP 引入复杂账号体系，除非配额、付费或 API 接入阶段需要。

## 当前事实源

- 产品需求：[docs/prd.md](../docs/prd.md)
- 技术方案：[docs/tech-design.md](../docs/tech-design.md)
- 测试计划：[docs/test-plan.md](../docs/test-plan.md)
- 项目命令与结构：[CLAUDE.md](../CLAUDE.md)

