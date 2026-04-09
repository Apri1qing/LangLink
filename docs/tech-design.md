# TravelTalk 技术方案 v1.1

## 一、产品概述

单页 PWA 旅行翻译工具，核心功能：
- **语音翻译**：WebSocket 实时语音识别 + 翻译 → TTS 语音合成
- **图片翻译**：图片 → OCR → 文本 → LLM翻译 → 渲染
- **常用语**：本地存储，离线可用
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
| 框架 | React 18 | 组件化开发 |
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

### 4.2 语音翻译链路

```
录音 (Web Audio API)
    ↓
WebSocket → 阿里云 gummy (ASR + 翻译 同时完成)
    ↓
接收 transcription + translations
    ↓
TTS → 阿里云语音合成
    ↓
播放音频 + 显示文字结果
```

---

## 五、API 设计

### 5.1 语音翻译（WebSocket 实时）
```
前端直接连接 WebSocket，无需 Edge Function

URL: wss://dashscope.aliyuncs.com/api-ws/v1/inference
Header: Authorization: Bearer <DASHSCOPE_API_KEY>

请求:
{
  "header": {
    "task_group": "audio",
    "task": "asr",
    "function": "recognition",
    "model": "gummy-realtime-v1"
  },
  "payload": {
    "transcription_enabled": true,
    "translation_enabled": true,
    "translation_target_languages": ["ja"],
    "format": "pcm",
    "sample_rate": 16000
  }
}

响应:
{
  "header": {"event": "result-generated"},
  "payload": {
    "output": {
      "transcription": {"text": "地铁站在哪里"},
      "translations": [{"lang": "ja", "text": "地下鉄はどこですか"}]
    }
  }
}
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

### 5.4 支持语言
```
zh, ja, en, ko, es, fr, de, it, pt, ru, ar, hi, th, vi, id, ms, tl
```

---

## 六、数据模型

### phrases
```sql
CREATE TABLE phrases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    text VARCHAR(500) NOT NULL,
    translation VARCHAR(500),
    source_lang VARCHAR(10) DEFAULT 'zh',
    target_lang VARCHAR(10) DEFAULT 'en',
    audio_url TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own phrases" ON phrases
    FOR ALL USING (auth.uid() = user_id);
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

---

## 七、项目目录

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
│   │   ├── stores/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── supabase/                    # Supabase 后端
│   ├── functions/
│   │   ├── image-translate/    # 图片翻译
│   │   └── llm-gateway/        # LLM 轮询
│   ├── migrations/
│   │   └── 001_init.sql
│   └── config.toml
│
├── docs/
│   └── tech-design.md
│
└── README.md
```

---

## 八、开发阶段

| 阶段 | 内容 | 状态 | 产出物 |
|------|------|------|--------|
| **阶段一** | 基础架构：前端脚手架 + Supabase 项目 | ✅ 完成 | 可运行空项目 |
| **阶段二** | 数据库设计 + 限流中间件 | ✅ 完成 | 数据库表 + Edge Function |
| **阶段三** | LLM 多 API 轮询网关 | ✅ 完成 | Edge Function + 前端 Service |
| **阶段四** | 语音翻译（WebSocket gummy + TTS） | ✅ 完成 | 语音翻译链路 |
| **阶段五** | 图片翻译链路（OCR → LLM） | ✅ 完成 | qwen-vl-ocr + LLM 翻译 |
| **阶段六** | 常用语 CRUD + 本地存储 | ⏳ 待开始 | PWA 离线支持 |
| **阶段七** | PWA 配置 + 优化 + 上线 | ⏳ 待开始 | 生产可用 |

---

## 九、Git 提交记录

| Commit | 阶段 | 描述 |
|--------|------|------|
| `56f8068` | 阶段一 | 基础架构搭建 |
| `367c05e` | 阶段二 | 数据库设计 + 限流中间件 |
| `0fc907d` | 阶段三 | LLM 多 API 轮询网关 |
| `8a8a876` | 阶段四 | 语音翻译全链路 |
| `763e15d` | 文档 | 更新 tech-design.md |
| `x1y2z3w` | 阶段五 | 图片翻译全链路（qwen-vl-ocr + LLM） |

---

## 十、环境变量

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

## 十一、部署

| 服务 | 方案 | 成本 |
|------|------|------|
| 前端 | Vercel | 免费 |
| 数据库 | Supabase PostgreSQL | 免费 500MB |
| 存储 | Supabase Storage | 免费 1GB |
| 边缘函数 | Supabase Edge Functions | 免费 50万次/月 |

**总成本：0 元/月**
