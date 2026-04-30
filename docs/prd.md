# TravelTalk PRD v1.4

> **v1.4 变更（2026-04-24）**：回归双 pill 方向明确 + 相机覆盖层重构
>
> - ♻️ **双 pill 回归**：撤销 v1.3 的单 pill + 自动检测。左 pill 说外语（pair.B→A），右 pill 说母语（pair.A→B）。点按 toggle，无 icon，pill 上只显示源语言名
> - 🆕 **相机覆盖层**：拍照后照片**常驻** Viewfinder；qwen-vl-ocr `advanced_recognition` 返回每段文字的 bbox，前端把译文以白色气泡**叠加**到对应位置（类 Instagram 滤镜）
> - 🆕 **照片控制**：左上 toggle 切原图/译文，右下删除回初始黑框
> - 🆕 **Viewfinder / 聊天区 65vh**：取景框与 VoiceMode 聊天区统一到屏幕 65%
> - 🗑️ **底卡只出一处**：仅"相机模式 + pill 录音 / phrase 翻译"时出底卡；VoiceMode 语音进气泡不出底卡
> - 🗑️ **大清理**：删除 Menu / Home_Result / Home_Recording / RecordPill / VoiceBar / ModeSwitcher 及 `'menu'/'result'/'recording'/'voiceMode'` page state；删除 `reconcileDirection` / `detectedLang` / `'auto'` 相关代码（仅图片翻译保留 auto，因为 OCR 原生多语种识别）
>
> **v1.3 变更（2026-04-23，已回滚）**：自动语言检测 + 单 pill + TopBar + Settings/History 拆分
> - TopBar / Settings / History 保留；自动检测 / 单 pill 回滚

## 一、产品概述

### 1.1 产品名称
TravelTalk

### 1.2 产品定位
一个极简的旅行翻译工具，通过「语音 + 图片 + 常用语」，帮助用户在陌生语言环境中完成即时沟通。

### 1.3 核心价值
- ✅ 不需要切页面（单页完成所有操作）
- ✅ 降低沟通成本（按住说即可）
- ✅ 支持「看图沟通」（菜单 / 路牌 / 标识）
- ✅ 即使不会外语，也能自然交流

### 1.4 目标用户
- 出境游客（重点：中国 → 日本）
- 不会外语的人群
- 临时跨语言沟通需求用户

---

## 二、核心使用场景

### 场景1：问路
1. 用户说：「地铁站在哪里」
2. 自动翻译为日语并播放
3. 对方回答
4. 用户录音 → 翻译为中文

### 场景2：看菜单
1. 拍照菜单
2. 自动翻译
3. 用户说：「这个是什么」
4. 对方回答 → 翻译

### 场景3：购物
- 点击「多少钱」
- 自动播放目标语言
- 对方回答 → 翻译

---

## 三、产品结构（单页设计）

### 3.1 五种状态

```
状态① Home（主屏幕/拍照模式）
    │
    ├── 顶部 TopBar：🕒 历史 / 📷🎙 模式 / ⚙ 设置（常驻）
    ├── 点击取景框 → 拍照 → 状态③
    ├── 点击常用语气泡 → 走完整翻译链路（翻译到当前 targetLang）→ 底卡展示 + 播放
    ├── 常用语 2 行横滑（上限 10 条；增删移至 Settings）
    └── 点击 TopBar 中 🎙 → 切到状态⑤（Voice Mode）；🕒/⚙ 跳 History/Settings

状态② 相机模式下录音（Home 内联，不跳页）
    │
    ├── 双 pill 点按：左 pill（源=pair.B，目标=pair.A）/ 右 pill（源=pair.A，目标=pair.B）
    ├── 录音中 pill 变 `#D94F00`，另一 pill 禁用
    ├── 支持流式的浏览器：Gummy PCM 流 → 底卡陆续出现原文/译文
    ├── 结束后出 TTS，自动播放一次；底卡下滑关闭
    └── 相机若已拍照，PhotoOverlay 照片常驻（pill 录音不影响照片） 

状态③ 拍照翻译叠加（v1.4：无独立 result 页，结果叠加在 Home 相机模式）
    │
    ├── Viewfinder 点击 → 开相机 → 拍照 → "使用照片" → 关闭相机，照片 setCapturedImage 到 store
    ├── 自动调 image-translate（qwen-vl-ocr advanced_recognition），取回 regions: [{originalText, translatedText, location}]
    ├── PhotoOverlay 渲染：原图 + 每个 region 一个白色气泡覆盖于对应位置
    ├── 左上角 toggle：切 "原图" / "译文叠加层"
    ├── 右下角删除：清空 capturedImage + ocrRegions → 回黑框
    └── 照片常驻，切页再回来仍保留

状态④ Settings（⚙ 设置）  [v1.3 从 Menu 拆出]
    │
    ├── 语言配对：下拉选择 A（母语）↔ B（外语），实时写回 store
    ├── 常用语管理：列表 + 删除 + 添加（上限 10 条；满 10 条隐藏 +）
    └── TopBar 常驻，点其他图标跳转

状态④b History（🕒 历史会话）  [v1.3 从 Menu 拆出]
    │
    ├── 会话列表：点击 → 载入到 VoiceMode 继续对话
    ├── 空态："暂无历史会话"
    └── TopBar 常驻

状态⑤ Voice Mode（仅语音对话模式）
    │
    ├── TopBar 常驻；对话区固定 65vh，下面是单大 pill 录音 + 常用语
    ├── 右下角浮动「➕ 新对话」按钮（messages>0 时显示）→ 归档当前 session
    ├── 对话气泡按「我 vs 对方」固定左右（方向由 detectedLang 判定）
    ├── 每条气泡右侧带 ▶ 播放键，点击播放该条的译文
    └── 下方常用语 2 行横滑可点击 → 弹翻译底卡 + 播放
```

### 3.2 页面布局

```
┌─────────────────────────────────┐
│        语言切换栏 (voiceBar)      │
│    [中文 🎙]     [日语 🎙]        │
├─────────────────────────────────┤
│                                 │
│         取景框 / 对话区            │
│     (拍照模式/语音模式不同)         │
│                                 │
├─────────────────────────────────┤
│      [📷 拍照]  [🎙 语音]        │
│         (modeSwitcher)           │
├─────────────────────────────────┤
│  常用语                    管理 › │
│  [多少钱] [地铁站] [可以刷卡吗]    │
│  [这个是] [谢谢] [洗手间] [+]     │
└─────────────────────────────────┘
```

---

## 四、功能模块

### 4.1 语音翻译模块

#### 功能描述
支持双向语音翻译：
- 母语 → 目标语言
- 目标语言 → 母语

#### 交互设计

**语言切换**：
- **长按**语言胶囊按钮（≥500ms）→ 弹出语言选择菜单
- 当前语言高亮（深色背景）

**点击即说话（Tap-to-Toggle）**：
1. **点击**（< 500ms）顶部语言 pill → 开始录音，pill 变棕色显示「● 点击结束」
2. **再次点击** → 结束录音 → 自动识别 → 进入结果页
3. 取消：再次点击同一 pill 即可结束；无"中途松开取消"语义

**结果展示（Home_Result + TranslationSheet）**：
- 翻译底卡从底部滑入
- 录音流式过程中：仅展示识别/翻译文字，**不播放**音频
- 整段识别与翻译完成后：**自动播放译文一次**；可点「播放译文」再次播放
- **无**「N 秒自动关闭」；用户**下滑顶部手柄条**关闭底卡
- 上滑拖动把手 → 全屏查看详细翻译（若实现）
- 点击「收起」或「✕」关闭

**Voice Mode（仅语音对话模式）**：
- 相机取景框隐藏；**去除底部大圆录音按钮**（对齐 UIUX.pen）
- 录音完全靠顶部 voiceBar：点击开始、再次点击结束
- 对话气泡按"我 vs 对方"固定左右；每条气泡带 ▶ 播放键
- 播放键使用该消息自己的 targetLang（不依赖全局当前 targetLang）
- 顶栏右上角 `⟲ 新对话` 按钮 → 归档当前 session，开新 session

#### 输出内容
- 原文（小字灰色）
- 翻译（大字深色）
- 自动语音播放

#### 异常处理
- 识别失败 → 提示「未识别到语音」
- 网络失败 → 提示「网络异常」
- 中途取消 → 返回待机状态

---

### 4.2 图片翻译模块

#### 功能描述
- 拍照识别图片文字
- 自动翻译并覆盖显示

#### 交互流程
1. 点击取景框区域（📷图标）
2. 打开相机
3. 拍照
4. 自动：
   - OCR识别
   - 翻译
   - 渲染

#### 展示方式
- 默认：覆盖翻译（替换文字）
- 支持：点击按钮切换「原图」

#### 状态管理
- 图片常驻（不自动消失）
- 用户可：删除、替换

---

### 4.3 常用语模块

#### 功能描述
用户自定义常用语；点击后**走完整翻译链路**翻译到当前目标语言，弹翻译底卡 + 播放。

#### 默认数据
- 多少钱 / 地铁站在哪里 / 可以刷卡吗 / 这个是什么 / 谢谢 / 洗手间在哪里

#### 用户操作

**添加**：点击「＋」→ 输入原文 → 保存（只存原文和源语言，不预存任何目标语言翻译）。

**删除**：Menu 里点「-」，或在首页左滑气泡。

**使用（关键改动 vs v1.1）**：
- 点击气泡 → 查 `phrase.translations[当前 targetLang]` 缓存
- 命中 → 立刻弹 TranslationSheet 展示缓存译文 + 播放
- 未命中 → 调用 `llm-gateway` 文本翻译 → 写回 `translations[targetLang]` → 弹底卡
- **同一条常用语可缓存多个目标语言**（中文→德文、中文→日文 互不影响）

#### 存储
- 本地存储（localStorage / IndexedDB）
- 结构（v1.2）：
  ```typescript
  interface Phrase {
    id: number
    text: string                            // 原文
    source_lang: LanguageCode               // 原文语言
    translations: Record<string, {          // 按目标语言 lazy 缓存
      translated: string
      audioUrl?: string
    }>
    usage_count: number
    created_at: string
    updated_at: string
  }
  ```

---

### 4.4 历史会话模块（v1.2 重构：跨模式 Session）

#### 核心概念：全局唯一 `currentSession`
一个 session 可以跨 Home 和 VoiceMode：**拍照、常用语、Home 顶栏录音、VoiceMode 对话都追加到同一 currentSession**。典型场景：拍菜单 → 对话询问 → 点常用语"多少钱"，全是同一段会话。

#### Session 边界判定规则

| 触发位置 | 规则 |
|---------|------|
| Home（拍照 / 常用语 / 顶栏录音） | 距离上条消息 **> 15 分钟** → 归档旧 session 新建；否则追加 |
| Voice Mode（对话） | **不看时间**，始终追加到当前 session |
| 手动点击「⟲ 新对话」（仅 VoiceMode 顶栏可见） | 立即归档旧 session 并新建 |
| 点击历史条目 | 将该 session 载入为 currentSession，可在 Home / VoiceMode 继续追加 |

> 关键直觉：**在 Home 翻译是"查词"场景**，idle 15min 后视为另一段行程的查词，故按时间切。**在 VoiceMode 里挂屏就是"在对话"**，即使 idle 也不应被系统武断切开，给用户"新对话"按钮自己控制。

#### 消息结构
```typescript
interface SessionMessage {
  id: string
  type: 'voice' | 'photo' | 'phrase'       // 来源类型
  originalText: string
  translatedText: string
  sourceLang: LanguageCode                  // 该条消息录制时的源语言
  targetLang: LanguageCode                  // 该条消息的目标语言（决定 ▶ 播放 TTS 语种）
  audioUrl?: string | null
  imageDataUrl?: string                     // photo 类型带图
  timestamp: number
}

interface Session {
  id: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number                         // 追加消息时更新；用于 15min 判定
  lastMessage: string                       // 预览文本（派生）
}
```

#### 交互操作
- **点击条目** → 将该 session 载为 currentSession + `displayMode='voice'` → 跳转到 VoiceMode，所有历史消息以气泡列出，可继续追加
- **左滑 / 点「-」** → 删除

#### 存储
- 本地存储 localStorage（MVP）；后续可迁 Supabase sessions 表

---

## 五、语言策略

### 5.1 支持方式
- 手动切换（胶囊按钮）
- 当前语言高亮显示

### 5.2 MVP范围
- 中文 ↔ 日文（优先）

---

## 六、MVP范围（必须控制）

### ✅ 包含
- 语音翻译（双向）
- 图片翻译（整图）
- 常用语（可增删）
- Voice Mode（仅语音模式）
- 历史会话

### ❌ 不包含（后续）
- 实时对话模式
- 流式翻译
- 离线模型
- 多用户同步

---

## 七、成功指标
- 日活用户数
- 每用户翻译次数
- 语音使用占比
- 图片翻译使用率

---

## 八、最后总结

这是一个「单页、低操作成本、围绕真实场景」的翻译工具，
核心竞争力在于：
👉 语音 + 图片 + 常用语 + Voice Mode 四者结合形成的连续沟通体验
