# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

TravelTalk 是一个旅行翻译 PWA 工具，支持语音翻译、图片翻译和常用语三大功能。MVP 聚焦中文 ↔ 日文，但支持多语言扩展。

## 开发命令

### 前端

```bash
cd frontend
npm install
npm run dev          # 启动开发服务器
npm run build        # TypeScript 检查 + 构建
npm run lint         # ESLint 检查
npm run test         # 运行测试（单次）
npm run test:watch   # 监视模式测试
```

### 后端（Supabase）

```bash
supabase start                              # 启动本地 Supabase
supabase functions serve                    # 启动所有 Edge Functions
supabase functions serve llm-gateway        # 启动单个 Function
supabase functions deploy voice-translate     # 部署语音翻译（含 PCM 流式入口）
supabase db reset                           # 重置数据库并应用迁移
```

## 环境变量

前端需在 `frontend/.env` 中配置：

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_FUNCTIONS_URL=...
```

## 架构

### 前端（`frontend/src/`）

- **React 19 + Vite + TypeScript + Tailwind CSS v4**
- 状态管理：**Zustand**
- 本地存储（常用语）：**Dexie**（IndexedDB 封装）
- 测试：**Vitest + @testing-library/react**

单页应用，按 `currentPage` / `displayMode` 渲染：

```
main.tsx
└── VoiceTranslateProvider（useVoiceTranslate 全局单例，避免录音中切页卸载）
    └── App.tsx
        ├── Home（拍照 + VoiceBar；可选 Voice 子区）
        ├── Home_Result（结果页 + TranslationSheet）
        ├── VoiceMode（仅语音 + 长按录音）
        └── Menu（历史会话、常用语管理）
```

**语音翻译链路**：
- `hooks/useVoiceTranslate.ts`：长按开始后，若浏览器支持 `fetch` 流式请求体（`supportsRequestBodyStream()`），则 `usePcmStream` 采集 16kHz PCM → `ReadableStream` → `POST .../voice-translate?sourceLang=&targetLang=`（`Content-Type: application/octet-stream`），响应为 **NDJSON**（`delta` / `complete`），边录边更新文案；否则降级为 `MediaRecorder` + 松手后整段 JSON（`stream: true`）同上。
- `hooks/usePcmStream.ts`：`createPcmReadableStream`、`startPcmFromMicrophone`（ScriptProcessor + 可选重采样到 16kHz）。
- `components/common/TranslationSheet.tsx`：识别/流式过程中仅展示文字、不自动播放；结束后自动播放译文一次；无倒计时自动关闭，需**下滑顶部手柄**关闭；保留「播放译文」手动重播。

核心服务层（`src/services/`）：
- `translation.ts` — 文本翻译走缓存 + `llm-gateway`；语音含 `voiceTranslatePcmRequestStream`（octet-stream）、`voiceTranslateFromPcm`（JSON base64 + NDJSON `stream: true`）、`imageTranslate` 等
- `supabase.ts` — Supabase 客户端初始化及配置检测
- `quota.ts` — 用户配额（free/pro）管理

### 后端（`supabase/functions/`）

Edge Functions 运行在 Deno 环境：

| Function | 职责 |
|----------|------|
| `llm-gateway` | 文本翻译，调用 LLM API |
| `voice-translate` | 语音翻译全链路：Edge 内 **WebSocket** 连接阿里云 **gummy-realtime-v1**；支持 **JSON base64** 或 **`application/octet-stream` PCM 流**；对前端可返回 **NDJSON**（`delta` + `complete` 含 TTS URL）；尾部静音与 `finish-task` 前后时序在服务端加固以降低末句丢失 |
| `image-translate` | 图片翻译：OCR → 翻译 |
| `rate-limiter` | API 限流中间件 |

### 数据库（`supabase/migrations/`）

- `translations_cache` 表：缓存翻译结果，key 格式为 `{sourceLang}:{targetLang}:{text前100字符}`
- 用户配额表：记录 free/pro 用户每日用量，`last_reset_date` 控制每日重置

## 类型系统

所有共享类型定义在 `frontend/src/types/index.ts`：
- `LanguageCode`：从 `SUPPORTED_LANGUAGES` 常量数组推断的联合类型
- `VoiceTranslateResponse` / `ImageTranslateResponse`：Edge Function 返回结构
- `Phrase`：常用语实体，含 `usage_count` 和可选的预缓存 `audio_url`

## 自动化测试（含麦克风权限）

browser-use 默认无法获取麦克风权限。使用 `scripts/start-test-browser.sh` 启动专用 Chrome：

```bash
./scripts/start-test-browser.sh              # 默认打开 localhost:5173
./scripts/start-test-browser.sh http://...   # 打开指定 URL
```

关键启动参数：
- `--auto-accept-camera-and-microphone-capture`：自动点击麦克风授权弹窗，**使用真实音频设备**
- 配合 `--user-data-dir=/tmp/chrome-traveltalk-test` 使用独立 Profile

脚本会通过 `getUserMedia` 验证麦克风可用（显示真实设备名如 `MacBook Air麦克风`）。

启动后 browser-use 命令加 `--cdp-url http://localhost:9222`：

```bash
browser-use --cdp-url http://localhost:9222 state
browser-use --cdp-url http://localhost:9222 screenshot /tmp/out.png
```

## 开发阶段状态

主路径语音翻译已接 **Supabase Edge `voice-translate` → 阿里云 DashScope Gummy**（密钥仅在 Edge，前端不直连 DashScope）。仓库中另有 `debug-test`、`gummy-test` 等函数用于联调。
