# TravelTalk 技术方案 v1.0

## 一、产品概述

单页 PWA 旅行翻译工具，核心功能：
- **语音翻译**：音频 → ASR → 文本 → LLM翻译 → TTS → 返回
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
           ASR            LLM              TTS/OCR
        (阿里云)      (多API轮询)          (阿里云)
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
| ASR | 阿里云 | 语音识别 |
| TTS | 阿里云 | 语音合成（日文最自然） |
| OCR | 阿里云 | 文字识别 |
| LLM | **用户自提供多 API** | 轮询调用，OpenAI 兼容格式 |

---

## 四、API 设计

### 4.1 语音翻译
```
POST /api/v1/voice/translate
{
  "audio": "base64-audio",
  "sourceLang": "zh",
  "targetLang": "ja",
  "format": "audio/webm"
}

响应:
{
  "code": 200,
  "data": {
    "originalText": "地铁站在哪里",
    "translatedText": "Where is the subway station?",
    "audioUrl": "/api/v1/voice/audio/{id}.mp3"
  }
}
```

### 4.2 图片翻译
```
POST /api/v1/image/translate
Content-Type: multipart/form-data

image: File
sourceLang: auto
targetLang: ja

响应:
{
  "code": 200,
  "data": {
    "originalText": "メニュー",
    "translatedText": "菜单",
    "translatedImageUrl": "/api/v1/image/result/{id}.png"
  }
}
```

### 4.3 常用语 CRUD
```
GET    /api/v1/phrases
POST   /api/v1/phrases
PUT    /api/v1/phrases/{id}
DELETE /api/v1/phrases/{id}
```

### 4.4 支持语言
```
zh, ja, en, ko, es, fr, de, it, pt, ru, ar, hi, th, vi, id, ms, tl
```

---

## 五、数据模型

### phrases
```sql
CREATE TABLE phrases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
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
    user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
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
    user_id UUID REFERENCES auth.users NOT NULL,
    type VARCHAR(10) NOT NULL,
    source_lang VARCHAR(10),
    target_lang VARCHAR(10),
    api_calls INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 六、项目目录

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
│   │   ├── services/
│   │   ├── stores/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── supabase/                    # Supabase 后端
│   ├── functions/
│   │   ├── voice-translate/
│   │   ├── image-translate/
│   │   └── llm-gateway/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── config.toml
│
├── docs/
│   └── tech-design.md          # 本文档
│
└── README.md
```

---

## 七、开发阶段

| 阶段 | 内容 | 状态 | 产出物 |
|------|------|------|--------|
| **阶段一** | 基础架构：前端脚手架 + Supabase 项目 | ✅ 完成 | 可运行空项目 |
| **阶段二** | 数据库设计 + 限流中间件 | ✅ 完成 | 数据库表 + Edge Function |
| **阶段三** | LLM 多 API 轮询网关 | ✅ 完成 | Edge Function + 前端 Service |
| **阶段四** | 语音翻译链路（ASR → LLM → TTS） | ⏳ 待开始 | 完整语音翻译 |
| **阶段五** | 图片翻译链路（OCR → LLM） | ⏳ 待开始 | 完整图片翻译 |
| **阶段六** | 常用语 CRUD + 本地存储 | ⏳ 待开始 | PWA 离线支持 |
| **阶段七** | PWA 配置 + 优化 + 上线 | ⏳ 待开始 | 生产可用 |

---

## 八、Git 提交规范

```
feat(phaseN): 阶段名称

- 具体改动1
- 具体改动2
```

### 提交记录

| Commit | 阶段 | 描述 |
|--------|------|------|
| `56f8068` | 阶段一 | 基础架构搭建 |
| `d1a9c70` | 文档 | 更新 tech-design.md |
| `0fc907d` | 阶段三 | LLM 多 API 轮询网关 |
| - | 阶段四 | (待开发) |
| - | 阶段四 | (待开发) |
| - | 阶段五 | (待开发) |
| - | 阶段六 | (待开发) |
| - | 阶段七 | (待开发) |

---

## 九、环境变量

### Supabase Secrets
```bash
# 阿里云 AI 服务
ALIYUN_ASR_ENDPOINT=https://nls-gateway.cn-shanghai.aliyuncs.com
ALIYUN_ASR_APPKEY=xxx
ALIYUN_ASR_ACCESS_KEY_ID=xxx
ALIYUN_ASR_ACCESS_KEY_SECRET=xxx

ALIYUN_TTS_ENDPOINT=https://nls-gateway.cn-shanghai.aliyuncs.com
ALIYUN_TTS_APPKEY=xxx
ALIYUN_TTS_ACCESS_KEY_ID=xxx
ALIYUN_TTS_ACCESS_KEY_SECRET=xxx

ALIYUN_OCR_ENDPOINT=https://ocrapi.cn-hangzhou.aliyuncs.com
ALIYUN_OCR_ACCESS_KEY_ID=xxx
ALIYUN_OCR_ACCESS_KEY_SECRET=xxx

# LLM 多 API 轮询
LLM_API_1=https://your-api-1.com/v1/chat/completions
LLM_API_KEY_1=sk-xxx
LLM_MODEL_1=gpt-4o

LLM_API_2=https://your-api-2.com/v1/chat/completions
LLM_API_KEY_2=sk-ant-xxx
LLM_MODEL_2=claude-3-5-sonnet
```

---

## 十、部署

| 服务 | 方案 | 成本 |
|------|------|------|
| 前端 | Vercel | 免费 |
| 数据库 | Supabase PostgreSQL | 免费 500MB |
| 存储 | Supabase Storage | 免费 1GB |
| 边缘函数 | Supabase Edge Functions | 免费 50万次/月 |

**总成本：0 元/月**
