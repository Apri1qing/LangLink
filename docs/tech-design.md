# TravelTalk 技术方案 v1.4

> **v1.4 关键技术变更（2026-04-24）**
>
> **方向判定回归 UI**
> - 撤销 v1.3 的自动检测。前端发请求时显式传 `sourceLang`/`targetLang`（由用户按哪个 pill 决定）
> - `useVoiceTranslate` 暴露 `startLeftRecording`（pair.B→A）/ `startRightRecording`（pair.A→B）
> - 删除 `reconcileDirection` / `detectedLang` 所有代码；删除 `SourceLangInput = LanguageCode | 'auto'` 联合类型（语音侧必填 LanguageCode；图片侧单独接受 `'auto'` 因为 OCR 自带多语种）
>
> **相机覆盖层（新）**
> - 后端 `image-translate` 改用 DashScope 原生 `multimodal-generation/generation` 端点，`parameters.ocr_options.task = 'advanced_recognition'`
> - 响应从单段 text 改为 `regions: [{originalText, translatedText, location: number[8]}]`，同时保留 `originalText` / `translatedText`（拼接）兼容
> - 批量翻译：一次 LLM 调用，prompt 要求 JSON 数组输出；失败时 gracefully fallback
> - 前端新增 `utils/bboxMap.ts`（`locationToPercent`）+ `components/common/PhotoOverlay.tsx`
> - `appStore` 新增 `ocrRegions: OcrRegion[]` + `showTranslatedOverlay: boolean` + `clearCapturedPhoto()`
>
> **布局重构**
> - Viewfinder / PhotoOverlay / VoiceMode 聊天区统一 65vh
> - 双 pill (`components/common/DualPill.tsx`) 放 Viewfinder 下方
> - 底卡仅在 Home 相机模式下条件渲染，不再有独立 `Home_Result` 页
>
> **AppPageState 简化**
> - `'home' | 'settings' | 'history'`（删 `'recording' | 'result' | 'menu' | 'voiceMode'`）
> - Home 内部按 `displayMode` 分 Home.tsx（拍照 + 双 pill）/ VoiceMode.tsx（聊天 + 双 pill）
>
> **删除**
> - Menu.tsx / Home_Result.tsx / Home_Recording.tsx / RecordPill.tsx / VoiceBar.tsx / ModeSwitcher.tsx
> - `resolveTranslationDirection` / `migrateLegacyLanguages`

## 一、产品概述

单页 PWA 旅行翻译工具，核心功能：
- **语音翻译**：WebSocket 实时语音识别 + 翻译 → TTS 语音合成
- **图片翻译**：图片 → OCR → 文本 → LLM翻译 → 渲染
- **常用语**：本地存储，离线可用
- **Voice Mode**：仅语音模式，对话气泡双向展示
- **历史会话**：记录每次翻译，可回顾和删除
- **支持语言**：全球主流语言

**商业模式**：B2B2C - 其他开发者/App 接入你的翻译 API 付费使用

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      PWA 前端 (React/Vite)                       │
│                   部署于 Vercel (免费 CDN)                        │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase (后端服务)                            │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐               │
│  │ Edge Funcs │   │ PostgreSQL │   │  Storage   │               │
│  │ (语音/图片) │   │ (数据存储)  │   │ (文件存储)  │               │
│  └────────────┘   └────────────┘   └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           ASR+翻译        TTS              OCR
        (阿里云gummy)   (阿里云)         (阿里云)
```

---

## 三、技术栈

### 前端
| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | **React 19** | 组件化开发 |
| 构建 | Vite 5 | 快速启动 |
| 语言 | TypeScript 5 | 类型安全 |
| 状态 | Zustand | 轻量状态管理 |
| PWA | Workbox | 离线缓存 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 存储 | IndexedDB (Dexie.js) | 本地持久化 |
| 音频 | Web Audio API | 录音播放 |

### 后端
| 类别 | 技术 | 说明 |
|------|------|------|
| 边缘函数 | Supabase Edge Functions | TypeScript/Deno |
| 数据库 | Supabase PostgreSQL | 免费 500MB |
| 存储 | Supabase Storage | 免费 1GB |
| 认证 | Supabase Auth | API Key 管理 |

### AI 服务
| 功能 | 厂商 | 说明 |
|------|------|------|
| ASR + 翻译 | **阿里云 gummy** | WebSocket 实时语音识别+翻译（一步完成） |
| TTS | 阿里云 | 语音合成（qwen3-tts-flash） |
| OCR | **阿里云 qwen-vl** | qwen-vl-ocr-latest 文字识别 |
| LLM | **用户自提供多 API** | 轮询调用，OpenAI 兼容格式 |

---

## 四、语音翻译技术方案

### 4.1 阿里云 gummy 实时语音 API

**接入方式**: WebSocket
**地址**: `wss://dashscope.aliyuncs.com/api-ws/v1/inference`

**鉴权**: `Authorization: Bearer <DASHSCOPE_API_KEY>`

**核心流程**:
```
1. 建立 WebSocket 连接
2. 发送 task_group=audio, task=asr, function=recognition
3. 启用 translation_enabled=true
4. 发送音频流（16kHz PCM）
5. 实时接收 transcription + translations
6. 发送 finish-task
7. 关闭连接
```

**消息格式**:
```json
// 发送：开始任务
{"header":{"task_group":"audio","task":"asr","function":"recognition","model":"gummy-realtime-v1"},"payload":{"transcription_enabled":true,"translation_enabled":true,"translation_target_languages":["en"],"format":"pcm","sample_rate":16000}}

// 发送：二进制音频
<binary audio data>

// 发送：结束任务
{"header":{"task_group":"audio","task":"asr","function":"recognition"},"payload":{"}}

// 接收：识别+翻译结果
{"header":{"event":"result-generated"},"payload":{"output":{"transcription":{"text":"原文"},"translations":[{"lang":"en","text":"翻译"}]}}}
```

### 4.2 语音翻译链路（经 Supabase Edge，不暴露密钥）

**API Key 仅存在于 Edge**（`DASHSCOPE_API_KEY`）。浏览器不直连 DashScope WebSocket。

**主路径（支持流式请求体的浏览器，如 Chrome/Edge）**：

```
getUserMedia → AudioContext + ScriptProcessor（usePcmStream）
    ↓
ReadableStream<Uint8Array>（16kHz mono s16le PCM 块）
    ↓
POST /voice-translate?sourceLang=&targetLang=
    Content-Type: application/octet-stream
    响应：application/x-ndjson（delta / complete）
    ↓
Edge：同一 invocation 内 WebSocket → Gummy，边读请求体边按 100ms 节奏发 PCM
    ↓
Gummy：result-generated → Edge 推 NDJSON delta
    流结束：尾部补静音 + finish-task → task-finished
    ↓
Edge：qwen3-tts-flash → complete 帧带 audioUrl
```

**降级路径（如 Safari：不支持 fetch request body stream）**：

```
MediaRecorder → 松手后 Blob → convertToPCM
    ↓
POST /voice-translate JSON body（audio: base64, stream: true）
    ↓
Edge：收齐整段 PCM 后按节奏发往 Gummy（NDJSON 同上）
```

**UI**：`TranslationSheet` 在 `isTranslating` 时只展示原文/译文、不播放 TTS；`setTranslationResult` 后自动播放译文一次；无自动关闭倒计时，用户**下滑手柄**关闭；可点「播放译文」重播。

### 4.3 Voice Mode（仅语音对话模式）

**特点（v1.2）**：
- 相机取景框隐藏；**去除底部大圆录音按钮**（对齐 UIUX.pen）
- 录音入口 = 顶部 voiceBar 两个语言 pill：点击开始 / 再次点击结束；长按 ≥500ms 弹语言菜单
- 对话气泡按"我 vs 对方"**固定**左右；每条气泡带 ▶ 播放键
- ▶ 播放键使用该条消息自己存的 `targetLang`，避免切换语言后历史气泡播错语种
- 顶栏右上角 `⟲ 新对话` 按钮手动归档 session

**状态管理**：
```typescript
interface AppState {
  // 页面 / 模式
  currentPage: 'home' | 'result' | 'menu'
  displayMode: 'photo' | 'voice'

  // 语言
  sourceLang: LanguageCode
  targetLang: LanguageCode

  // Session（v1.2 新增）
  currentSessionId: string | null             // 跨 Home/VoiceMode 的当前 session
  setCurrentSessionId: (id: string | null) => void

  // 翻译结果（TranslationSheet 使用）
  originalText: string
  translatedText: string
  translationType: 'voice' | 'photo' | 'phrase'
  translationAudioUrl: string | null
  isTranslating: boolean
  translationError: string | null
}

// 单条消息持久化在 Session 里，不再存 appStore.messages
interface SessionMessage {
  id: string
  type: 'voice' | 'photo' | 'phrase'
  originalText: string
  translatedText: string
  sourceLang: LanguageCode                    // 录制时的源语言
  targetLang: LanguageCode                    // 决定播放 TTS 语种
  audioUrl?: string | null
  imageDataUrl?: string
  timestamp: number
}
```

**气泡左右判定**：
```typescript
const isUser = message.sourceLang === appStore.sourceLang
// isUser → 右侧深色气泡（我）；否则左侧浅色气泡（对方）
```

**Session 边界（封装在 util）**：
```typescript
const IDLE_WINDOW_MS = 15 * 60 * 1000

function resolveSessionForNewMessage(ctx: {
  currentSessionId: string | null
  displayMode: 'photo' | 'voice'
}): { sessionId: string; isNew: boolean } {
  if (!ctx.currentSessionId) return createSession()
  const s = getSession(ctx.currentSessionId)
  if (ctx.displayMode === 'voice') return appendTo(s)     // VoiceMode 不按时间切
  const last = s.messages.at(-1)?.timestamp ?? s.updatedAt
  if (Date.now() - last > IDLE_WINDOW_MS) return createSession()
  return appendTo(s)
}
```

---

## 五、API 设计

### 5.1 语音翻译（Edge Function `voice-translate`）

对外暴露 **HTTPS**，由 Edge 内部连接 **Gummy WebSocket**（见 §4.1 消息格式）。

**方式 A — PCM 流（实时）**

```
POST {FUNCTIONS_URL}/voice-translate?sourceLang=zh&targetLang=ja
Authorization: Bearer <Supabase JWT 或 anon key>
Content-Type: application/octet-stream
Body: ReadableStream<Uint8Array>（PCM 二进制流）

响应: Content-Type: application/x-ndjson
每行 JSON：{"type":"delta","originalText":"...","translatedText":"..."}
末行：{"type":"complete","success":true,"originalText":"...","translatedText":"...","audioUrl":"..."}
```

**方式 B — JSON 整段（兼容 / 降级）**

```
POST {FUNCTIONS_URL}/voice-translate
Authorization: Bearer <...>
Content-Type: application/json

{
  "audio": "<base64 PCM 16kHz mono>",
  "sourceLang": "zh",
  "targetLang": "ja",
  "format": "audio/pcm",
  "stream": true
}

响应：同 NDJSON（stream: true 时）或单次 JSON（stream 省略时）
```

### 5.2 图片翻译
```
POST /api/v1/image/translate
Content-Type: application/json

{
  "image": "base64-image",
  "sourceLang": "ja",
  "targetLang": "zh"
}

响应:
{
  "success": true,
  "originalText": "メニュー",
  "translatedText": "菜单"
}
```

**技术链路**:
```
图片 (base64)
    ↓
qwen-vl-ocr-latest (OCR 文字识别)
    ↓
提取文本
    ↓
LLM 翻译 (用户配置的多 API 轮询)
    ↓
返回翻译结果
```

### 5.3 常用语 CRUD
```
GET    /api/v1/phrases
POST   /api/v1/phrases
PUT    /api/v1/phrases/{id}
DELETE /api/v1/phrases/{id}
```

### 5.4 历史会话 API
```
GET    /api/v1/sessions          # 获取所有会话
GET    /api/v1/sessions/{id}    # 获取单个会话详情
DELETE /api/v1/sessions/{id}    # 删除会话
```

### 5.5 支持语言
```
zh, ja, en, ko, es, fr, de, it, pt, ru, ar, hi, th, vi, id, ms, tl
```

---

## 六、数据模型

### phrases（v1.2：多语言 lazy 缓存）

**设计决策**：不预绑定 `target_lang`，也不预存 `translation`。每个常用语保存原文，目标语翻译按需 lazy 生成并缓存到 `translations` JSON 字段。

**本地存储（localStorage key: `traveltalk_phrases`）前端结构**：
```typescript
interface Phrase {
  id: number
  text: string
  source_lang: LanguageCode
  translations: Record<string, {
    translated: string
    audioUrl?: string
  }>
  usage_count: number
  created_at: string
  updated_at: string
}
```

**Supabase（可选云端同步）**：
```sql
CREATE TABLE phrases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    text VARCHAR(500) NOT NULL,
    source_lang VARCHAR(10) DEFAULT 'zh',
    translations JSONB DEFAULT '{}',          -- { "ja": {translated, audioUrl}, "de": {...} }
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own phrases" ON phrases
    FOR ALL USING (auth.uid() = user_id);
```

**点击流程**（前端）：
```
点击常用语
  ├─ 查 phrase.translations[appStore.targetLang]
  ├─ 命中 → setTranslationResult(text, cached.translated, 'phrase', cached.audioUrl)
  └─ 未命中 → translateText(text, source, target)
              → 写回 translations[target]
              → setTranslationResult(...)
→ Home_Result 弹 TranslationSheet 自动播放
→ 同时作为一条 SessionMessage（type:'phrase'）追加到 currentSession
```

**迁移老数据**（读旧 localStorage 格式时）：
```typescript
function migrateLegacyPhrase(old: LegacyPhrase): Phrase {
  const translations = old.translation
    ? { [old.target_lang ?? 'ja']: { translated: old.translation } }
    : {}
  return { id, text: old.text, source_lang: old.source_lang, translations, ... }
}
```

### translations_cache
```sql
CREATE TABLE translations_cache (
    id BIGSERIAL PRIMARY KEY,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    source_text VARCHAR(1000) NOT NULL,
    translated_text VARCHAR(1000) NOT NULL,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);
```

### user_quotas
```sql
CREATE TABLE user_quotas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
    plan VARCHAR(20) DEFAULT 'free',
    daily_limit INTEGER DEFAULT 50,
    daily_used INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### translation_logs
```sql
CREATE TABLE translation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL,
    source_lang VARCHAR(10),
    target_lang VARCHAR(10),
    api_calls INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### sessions（v1.2：跨模式 Session + 15min idle 自动归档）

**设计决策**：
- 一个 session 可包含混合类型消息（voice + photo + phrase 混在一起）
- Session 边界不再由"进入 result 页面"触发，而是由 `resolveSessionForNewMessage` 判定（见 §4.3）
- 每条消息存自己的 `sourceLang/targetLang`，确保 ▶ 播放使用原录制语言，切换全局语言后历史仍正确

**本地存储（localStorage key: `traveltalk_sessions`）**：
```typescript
interface Session {
  id: string
  messages: SessionMessage[]         // 见 §4.3 SessionMessage
  createdAt: number
  updatedAt: number
  lastMessage: string                // 派生：最后一条 translatedText.slice(0, 50)
}
```

**Supabase**：
```sql
CREATE TABLE sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    messages JSONB DEFAULT '[]',   -- SessionMessage[]
    last_message VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON sessions
    FOR ALL USING (auth.uid() = user_id);
```

**去掉了 v1.1 的字段**：`type` / `source_lang` / `target_lang`（因为 session 跨类型、跨语言方向，这些信息下沉到单条 `SessionMessage`）。

---

## 七、前端目录结构

```
frontend/src/
├── App.tsx                    # 主应用，状态机管理
├── components/
│   ├── VoiceTranslate/       # 语音翻译（含 Voice Mode）
│   ├── ImageTranslate/        # 图片翻译
│   └── Phrases/              # 常用语管理
├── hooks/
│   └── useVoice.ts           # 录音 + WebSocket
├── services/
│   ├── translation.ts        # 翻译主入口
│   ├── supabase.ts           # Supabase 客户端
│   └── quota.ts              # 用户配额管理
├── stores/
│   └── appStore.ts           # Zustand 状态管理
│                              # - currentMode: 'photo' | 'voice'
│                              # - voiceModeMessages: ConversationMessage[]
│                              # - currentSession: Session | null
└── types/
    └── index.ts              # 类型定义
```

---

## 八、项目目录

```
travelingAssistant/
├── frontend/                    # React PWA 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceTranslate/
│   │   │   ├── ImageTranslate/
│   │   │   ├── Phrases/
│   │   │   └── common/
│   │   ├── hooks/
│   │   │   └── useVoice.ts    # 录音 + WebSocket
│   │   ├── services/
│   │   ├── stores/             # Zustand 状态
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── supabase/                    # Supabase 后端
│   ├── functions/
│   │   ├── image-translate/    # 图片翻译
│   │   ├── voice-translate/    # 语音翻译
│   │   └── llm-gateway/        # LLM 轮询
│   ├── migrations/
│   │   └── 001_init.sql
│   └── config.toml
│
├── docs/
│   ├── prd.md                  # 产品需求文档
│   ├── design.md                # 设计文档
│   └── tech-design.md          # 技术设计文档
│
└── README.md
```

---

## 九、开发阶段

| 阶段 | 内容 | 状态 | 产出物 |
|------|------|------|--------|
| **阶段一** | 基础架构：前端脚手架 + Supabase 项目 | ✅ 完成 | 可运行空项目 |
| **阶段二** | 数据库设计 + 限流中间件 | ✅ 完成 | 数据库表 + Edge Function |
| **阶段三** | LLM 多 API 轮询网关 | ✅ 完成 | Edge Function + 前端 Service |
| **阶段四** | 语音翻译（WebSocket gummy + TTS） | ✅ 完成 | 语音翻译链路 |
| **阶段五** | 图片翻译链路（OCR → LLM） | ✅ 完成 | qwen-vl-ocr + LLM 翻译 |
| **阶段六** | 常用语 CRUD + 本地存储 | ✅ 完成 | Phrases 组件 |
| **阶段七** | UI 设计 | ✅ 完成 | Pencil 5 状态设计 |
| **阶段八** | UI 实现（代码） | ✅ 完成 | 按 design.md 实现 |
| **阶段九** | PWA 配置 + 优化 + 上线 | ⏳ 待开始 | 生产可用 |

> ✅ 阶段八已完成。已解决移动端兼容性问题（iOS Safari HTTPS、录音格式、Touch 事件）。

---

## 十、Git 提交记录

| Commit | 阶段 | 描述 |
|--------|------|------|
| `56f8068` | 阶段一 | 基础架构搭建 |
| `367c05e` | 阶段二 | 数据库设计 + 限流中间件 |
| `0fc907d` | 阶段三 | LLM 多 API 轮询网关 |
| `8a8a876` | 阶段四 | 语音翻译全链路 |
| `763e15d` | 文档 | 更新 tech-design.md |
| `x1y2z3w` | 阶段五 | 图片翻译全链路（qwen-vl-ocr + LLM） |
| `179f204` | 修复 | 语音翻译音频格式转换 |
| `5db1e1e` | 修复 | 更新 gummy WebSocket 协议 |
| `6c82e43` | 修复 | 更新 voice-translate gummy 协议 |
| `8338d21` | 阶段四+五 | 语音翻译+图片翻译 |
| `2026-04-22` | 修复 | iOS Safari 移动端兼容性（HTTPS、Touch事件、录音格式） |

---

## 十一、环境变量

### 阿里云（统一使用 DASHSCOPE_API_KEY）

**gummy 实时语音（ASR + 翻译）：**
- WebSocket: `wss://dashscope.aliyuncs.com/api-ws/v1/inference`

**TTS 语音合成：**
- Endpoint: `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- Model: `qwen3-tts-flash`

**OCR 文字识别：**
- Endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- Model: `qwen-vl-ocr-latest`

**统一密钥：**
```
DASHSCOPE_API_KEY=你的dashscope密钥
```

### LLM（翻译 - 用户自提供）

```
LLM_API_1=https://your-api-1.com/v1/chat/completions
LLM_API_KEY_1=sk-xxx
LLM_MODEL_1=gpt-4o

LLM_API_2=https://your-api-2.com/v1/chat/completions
LLM_API_KEY_2=sk-ant-xxx
LLM_MODEL_2=claude-3-5-sonnet
```

### Supabase（Edge Functions）

```
SUPABASE_URL=https://eulnavmuqtnbtwcwlmzp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 十二、移动端兼容性

### 12.1 iOS Safari 特殊处理

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **getUserMedia 不可用** | iOS 要求 HTTPS | 使用 Cloudflare Tunnel / ngrok 提供 HTTPS |
| **PCM 解码失败** | iOS 不支持 webm/opus | 优先使用 `audio/mp4` 格式录制 |
| **Touch/Pointer 事件冲突** | iOS 同时触发两种事件 | 只使用 Touch 事件，添加 `e.preventDefault()` |
| **crypto.randomUUID 不可用** | iOS 15 以下不支持 | 使用 UUID polyfill |
| **长按触发两次** | Touch + Pointer 同时触发 | 使用 `activeRef` 标志防止重复触发 |
| **TranslationSheet 滑动关闭失效** | 背景页面滚动而非关闭 | 添加 `e.preventDefault()` + CSS `touch-action: none` + `overscroll-behavior: contain` |

### 12.2 录音格式优先级

```typescript
const mimeTypePriority = [
  'audio/mp4',           // iOS 首选
  'audio/mp4;codecs=mp4a',
  'audio/aac',
  'audio/webm;codecs=opus', // Android/桌面
  'audio/webm',
  'audio/ogg;codecs=opus',
]
```

### 12.3 长按录音实现

- **Touch 事件**：`onTouchStart` / `onTouchEnd` / `onTouchCancel`
- **长按阈值**：300ms
- **防重复**：使用 `activeRef` 标志
- **阻止默认**：`e.preventDefault()` 防止页面滚动

### 12.4 HTTPS 开发环境

使用 Cloudflare Tunnel：
```bash
cloudflared tunnel --url http://localhost:5173
```

---

## 十三、部署

| 服务 | 方案 | 成本 |
|------|------|------|
| 前端 | Vercel | 免费 |
| 数据库 | Supabase PostgreSQL | 免费 500MB |
| 存储 | Supabase Storage | 免费 1GB |
| 边缘函数 | Supabase Edge Functions | 免费 50万次/月 |

**总成本：0 元/月**

---

## 十三、实施计划

### 13.1 当前状态 vs 设计状态

| 组件 | 现有实现 | 设计要求 |
|------|---------|---------|
| App.tsx | Tab 导航 (3个独立页面) | 单页状态机 + modeSwitcher |
| VoiceTranslate | 点击录音按钮 | **按住说话** (press-to-talk) |
| Home 页面 | 无 viewfinder | viewfinder + modeSwitcher + phrases |
| Home_Result | 内嵌结果展示 | 底部卡片 + 3秒自动关闭 |
| Menu | 无 | 历史会话列表 + 常用语管理 |
| Voice Mode | 无 | 仅语音 + 对话气泡 |

### 13.2 实施顺序

```
阶段 A：基础设施
  ├── A1. 创建 Zustand Store（appStore）
  ├── A2. 创建 useLongPress Hook
  └── A3. 创建 TranslationSheet 组件

阶段 B：核心 UI 重构
  ├── B1. 重构 App.tsx 状态机
  ├── B2. 实现 Home 页面（viewfinder + modeSwitcher + phrases）
  ├── B3. 实现 Home_Recording 页面（按住说话）
  └── B4. 实现 Home_Result 页面（底部卡片）

阶段 C：Menu 和 Voice Mode
  ├── C1. 实现 Menu 页面（历史会话 + 常用语管理）
  └── C2. 实现 Voice Mode（对话气泡）

阶段 D：集成与优化
  ├── D1. 连接状态机与所有组件
  ├── D2. 实现 3秒自动关闭
  ├── D3. 实现上滑全屏
  └── D4. PWA 配置
```

### 13.3 详细实施步骤

#### A1. 创建 Zustand Store（appStore）

```typescript
// frontend/src/stores/appStore.ts
interface AppState {
  // 页面状态
  currentState: 'home' | 'recording' | 'result' | 'menu' | 'voiceMode'
  currentMode: 'photo' | 'voice'

  // 语言
  sourceLang: LanguageCode
  targetLang: LanguageCode

  // 翻译结果
  originalText: string
  translatedText: string
  showResult: boolean

  // Voice Mode
  messages: ConversationMessage[]

  // 历史会话
  sessions: Session[]

  // Actions
  setSourceLang: (lang: LanguageCode) => void
  setTargetLang: (lang: LanguageCode) => void
  switchMode: (mode: 'photo' | 'voice') => void
  startRecording: () => void
  stopRecording: () => void
  showTranslation: (original: string, translated: string) => void
  hideResult: () => void
  addMessage: (msg: ConversationMessage) => void
  clearMessages: () => void
}
```

#### A2. 创建 useLongPress Hook

```typescript
// frontend/src/hooks/useLongPress.ts
// 监听 mousedown/mouseup 和 touchstart/touchend
// 长按阈值：300ms
// 返回 { isPressed, handlers }
```

#### A3. 创建 TranslationSheet 组件

```typescript
// frontend/src/components/common/TranslationSheet.tsx
// Props: { originalText, translatedText, onClose, autoCloseMs: 3000 }
// 底部卡片，300ms ease-out 滑入
// 3秒后自动关闭（或手动关闭）
```

#### B1. 重构 App.tsx 状态机

```typescript
// 替换 Tab 导航为 modeSwitcher
// 根据 currentState 渲染不同组件
// <Home /> | <Home_Recording /> | <Home_Result /> | <Menu /> | <VoiceMode />
```

#### B2. 实现 Home 页面

```typescript
// frontend/src/components/Home/Home.tsx
// - voiceBar: 语言胶囊
// - viewfinder: 黑色圆角，📷图标
// - modeSwitcher: 📷/🎙 tab
// - phrasesWrap: 常用语气泡 + 管理入口
```

#### B3. 实现 Home_Recording 页面

```typescript
// frontend/src/components/Home/Home_Recording.tsx
// - voiceBar: 中间胶囊显示「● 松开结束」
// - viewfinder: 相机实时预览
// - phrasesStrip: 常用语气泡
// - useLongPress: 按住说话按钮
```

#### B4. 实现 Home_Result 页面

```typescript
// frontend/src/components/Home/Home_Result.tsx
// - viewfinder: 相机画面始终可见
// - TranslationSheet: 翻译结果卡片
//   - 拖动把手
//   - 原文 + 译文
//   - 播放按钮
```

#### C1. 实现 Menu 页面

```typescript
// frontend/src/components/Menu/Menu.tsx
// - NavBar: 返回按钮
// - Section A: 历史会话列表
//   - 点击查看
//   - 左滑删除
// - Section B: 常用语管理
//   - - 删除按钮
//   - + 添加入口
```

#### C2. 实现 Voice Mode

```typescript
// frontend/src/components/VoiceMode/VoiceMode.tsx
// - voiceBar: 语言胶囊
// - convoArea: 对话气泡列表
//   - 用户消息（右对齐，深色）
//   - 对方消息（左对齐，浅色）
// - modeSwitcher
// - phrasesWrap
```

### 13.4 组件文件结构

```
frontend/src/
├── App.tsx                         # 状态机
├── components/
│   ├── Home/
│   │   ├── Home.tsx               # 主屏幕
│   │   ├── Home_Recording.tsx     # 录音中
│   │   ├── Home_Result.tsx        # 结果展示
│   │   └── components/
│   │       ├── VoiceBar.tsx       # 语言胶囊
│   │       ├── Viewfinder.tsx      # 取景框
│   │       ├── ModeSwitcher.tsx    # 模式切换
│   │       ├── PhrasesWrap.tsx     # 常用语
│   │       └── TranslationSheet.tsx # 结果卡片
│   ├── VoiceMode/
│   │   ├── VoiceMode.tsx          # 仅语音模式
│   │   └── ConversationBubble.tsx  # 对话气泡
│   ├── Menu/
│   │   ├── Menu.tsx               # 菜单页
│   │   ├── HistoryList.tsx         # 历史会话
│   │   └── PhrasesManager.tsx     # 常用语管理
│   ├── ImageTranslate/             # 已存在
│   └── common/
│       └── LongPressButton.tsx     # 长按按钮
├── hooks/
│   ├── useLongPress.ts            # 新增
│   └── useVoice.ts                # 已存在
├── stores/
│   └── appStore.ts                # 新增
└── types/
    └── index.ts                    # 更新
```

### 13.5 实施检查清单

- [ ] A1. Zustand Store 创建并验证
- [ ] A2. useLongPress Hook 实现
- [ ] A3. TranslationSheet 组件实现
- [ ] B1. App.tsx 状态机替换 Tab 导航
- [ ] B2. Home 页面所有组件
- [ ] B3. Home_Recording 按住说话功能
- [ ] B4. Home_Result 底部卡片 + 3秒关闭
- [ ] C1. Menu 页面
- [ ] C2. Voice Mode 对话气泡
- [ ] D1. 全局状态连接测试
- [ ] D2. 3秒自动关闭验证
- [ ] D3. 上滑全屏验证
- [x] D4. PWA manifest + service worker

### 13.6 优先级建议

**P0（必须）**：B1 + B2 + B3 + B4 — 核心语音翻译流程
**P1（重要）**：C2 — Voice Mode
**P2（次要）**：C1 — Menu + 历史会话
**P3（可选）**：D4 — PWA 配置

---

## 十四、v1.2 UI/UX 对齐 & 交互重构

### 14.1 背景
v1.1 实现与 `UIUX.pen` / 用户心智在以下 5 点上不符，v1.2 专门修复：

| # | 问题 | 根因 | v1.2 方案 |
|---|------|------|-----------|
| 1 | VoiceMode 底部出现设计稿里没有的大圆红按钮 | `VoiceMode.tsx:84-98` 额外加了 LongPress 按钮 | 删除，仅保留顶部 voiceBar 两个语言 pill |
| 2 | 常用语点击永远播日语 | `phrases.ts` 硬编码 `target_lang:'ja'` + `translation` 字段即日文字符串 | 重构为 `translations: Record<lang, ...>` lazy 缓存；点击走完整翻译 + TranslationSheet |
| 3 | 对话气泡缺播放键且硬编码 `speakText(..., 'ja')` | `ConversationBubble.tsx:12` | 每条 SessionMessage 存自己的 `sourceLang/targetLang`；按 `sourceLang === appStore.sourceLang` 判左右；▶ 播放用消息自己的 targetLang |
| 4 | Session 语义混乱，历史点击是 TODO | App.tsx 的 useEffect 每次进 result 就新建 session | 跨模式 currentSession + 15min idle 自动切（Home）+ 手动「⟲ 新对话」（VoiceMode）+ 历史点击载入 |
| 5 | 顶部录音交互与用户期望相反（短按切语言 / 长按 300ms 录音） | `VoiceBar.tsx:39-128` | 反转：**点击 toggle 录音**，**长按 ≥500ms 弹语言菜单** |

### 14.2 关键代码改动点

| 文件 | 改动 |
|------|------|
| `components/common/VoiceBar.tsx` | touch/mouse handlers 反转语义；文案「松开结束」→「点击结束」；阈值 300→500ms |
| `components/VoiceMode/VoiceMode.tsx` | 删 `{/* Long Press Button */}` 块及对应 handlers；从渲染 `appStore.messages` 改为渲染 `getSession(currentSessionId)?.messages` |
| `components/VoiceMode/ConversationBubble.tsx` | 按 `message.sourceLang === appStore.sourceLang` 判定左右；加 ▶ 按钮；移除硬编码 `'ja'` |
| `services/phrases.ts` | 结构改造（`translations: Record<lang, ...>`）；加 `migrateLegacyPhrase`；`addPhrase` 只带原文和 source_lang |
| `services/sessions.ts` | 扩展 `Session.messages[]` / `SessionMessage`；新增 `createSession` / `appendToSession` / `getSession` |
| `services/translation.ts` | 复用 `translateText` 给常用语走 llm-gateway 文本翻译 |
| `stores/appStore.ts` | 加 `currentSessionId`；删除 `messages[]`（迁移到 session）；`ConversationMessage` 类型归并到 `SessionMessage` |
| `hooks/useVoiceTranslate.ts` | 翻译完成后调 `recordTranslation(message)` 统一入口，不再直接 `addMessage` |
| `App.tsx` | 实现 `handleSessionClick`（载入 session + 跳 VoiceMode）；删除旧的自动 addSession useEffect |

### 14.3 Session 边界判定（核心 util）

```typescript
// services/sessions.ts
const IDLE_WINDOW_MS = 15 * 60 * 1000

export function recordTranslation(msg: Omit<SessionMessage, 'id' | 'timestamp'>) {
  const { currentSessionId, displayMode, setCurrentSessionId } = useAppStore.getState()
  const now = Date.now()
  const message: SessionMessage = { ...msg, id: generateUUID(), timestamp: now }

  const currentSession = currentSessionId ? getSession(currentSessionId) : null
  const shouldCreateNew =
    !currentSession ||
    (displayMode === 'photo' &&
     now - (currentSession.messages.at(-1)?.timestamp ?? 0) > IDLE_WINDOW_MS)

  if (shouldCreateNew) {
    const session = createSession(message)
    setCurrentSessionId(session.id)
  } else {
    appendToSession(currentSessionId!, message)
  }
}
```

### 14.4 迁移策略

- **localStorage 向后兼容**：`getStoredPhrases()` 读取时检测老字段 `translation`/`target_lang`，自动迁移为 `translations[target_lang] = { translated: translation }`，一次性写回新格式
- **Session localStorage**：老数据字段 `type/source_lang/target_lang/lastMessage/timestamp` 被迁移为一个 `messages: []` 单元素数组 + 空 `messages`（或丢弃，用户可接受）

### 14.5 实施分 3 个 commit

1. **Commit 1**：VoiceBar 交互反转 + 删 VoiceMode 红按钮（需求 1、5）
2. **Commit 2**：Phrase 结构重构 + 走完整翻译（需求 2）
3. **Commit 3**：跨模式 Session + 气泡播放键 + 历史跳转（需求 3、4）
