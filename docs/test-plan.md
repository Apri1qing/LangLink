# TravelTalk 测试计划 v1.3

## 一、测试范围

基于 `prd.md`、`tech-design.md`、`DESIGN.md` 和 v1.3 重构方案设计的测试用例，覆盖所有功能模块和交互流程。

**v1.3 重构重点**：
- 自动语言检测（单 pill 替代双 pill）
- TopBar 常驻导航（历史/设置/模式切换）
- Settings 页管理语言配对
- 常用语 2 行横滑 + 上限 10 条
- TranslationSheet 下滑关闭修复

---

## 二、测试环境

| 项目 | 说明 |
|------|------|
| 设备 | iPhone 14 Pro (390×844px) 或 Chrome DevTools 移动模拟器 |
| 浏览器 | Safari / Chrome 最新版 |
| 后端 | Supabase 本地函数或远程 Edge Functions |
| AI 服务 | 阿里云 gummy (ASR+翻译)、qwen-vl-ocr (OCR) |
| 麦克风 | 需要真实麦克风权限（参考 `scripts/start-test-browser.sh`） |

---

## 三、测试用例

### 3.1 TopBar 导航（所有页面常驻）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| TB1 | 点击历史图标 | 任意页面点击左上角 🕒 | 跳转到 History 页 |
| TB2 | 点击设置图标 | 任意页面点击右上角 ⚙ | 跳转到 Settings 页 |
| TB3 | 模式切换 | 点击中间 📷 或 🎙 | 切换 displayMode，当前模式高亮 |
| TB4 | TopBar 常驻性 | 在 Home / VoiceMode / History / Settings 间切换 | TopBar 始终可见且功能一致 |

---

### 3.2 Settings 页（语言配对 + 常用语管理）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| S1 | 查看语言配对 | 进入 Settings | 显示 `[中文 ▾] ↔ [日语 ▾]` 两个下拉框 |
| S2 | 切换母语（A） | 点击左侧下拉，选"德语" | 更新 appStore.languagePair.A = 'de' |
| S3 | 切换外语（B） | 点击右侧下拉，选"英语" | 更新 appStore.languagePair.B = 'en' |
| S4 | 配对持久化 | 切换后刷新页面 | 语言配对保持（localStorage） |
| S5 | 常用语列表 | Settings 下方 | 显示所有常用语（≤10 条） |
| S6 | 添加常用语 | 点击"+ 添加常用语"，输入"机场在哪" | 新条目出现在列表 |
| S7 | 满 10 条隐藏添加按钮 | 添加到第 10 条 | "+ 添加常用语"按钮消失 |
| S8 | 删除常用语 | 点击某条目左侧删除按钮 | 条目移除，若原本 10 条则添加按钮重新出现 |

---

### 3.3 自动语言检测（AUTO）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| AUTO1 | 检测到母语 A | Settings 设 `zh↔de`，Home 录音说中文 | 翻译成德语 |
| AUTO2 | 检测到外语 B | 同上配置，录音说德语 | 翻译成中文 |
| AUTO3 | 检测到第三语言 | 同上配置，录音说英语 | 翻译成中文（默认母语 A） |
| AUTO4 | 后端回传 detectedLang | 任意录音 | 响应 JSON 含 `detectedLang` 字段 |
| AUTO5 | 图片翻译自动检测 | 拍摄英文菜单（Settings 设 zh↔de） | OCR 识别英文 → 翻译成中文 |

---

### 3.4 单 Pill 录音（替代 v1.2 双 pill）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| RP1 | 点击开始录音 | Home 短按 🎙 pill | Pill 变棕色显示「● 点击结束」 |
| RP2 | 再次点击结束录音 | 录音中再次点击 | 上传 → 自动检测语言 → 翻译 → 播放 |
| RP3 | 录音无声音 | 录音后不说话，再次点击结束 | 提示「未识别到语音」或类似错误 |
| RP4 | VoiceMode 录音 | VoiceMode 点击 pill | 气泡追加到聊天区，pill 恢复 |

---

### 3.5 语音翻译（Voice Mode，v1.3 重构）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| VM1 | 切换到 Voice Mode | Home 点击 TopBar 中间 🎙 | 进入 Voice Mode，**隐藏取景框** |
| VM2 | Voice Mode 录音 | 点击单个 🎙 pill 说话后再次点击 | 对话区出现新气泡，含原文+译文+▶ 按钮 |
| VM3 | 气泡 ▶ 播放 | 点击任一气泡旁的 ▶ | 播放该条消息的译文（即使全局语言已切换） |
| VM4 | 常用语点击（VoiceMode 内） | 点击下方常用语「多少钱」 | 弹 TranslationSheet 翻译到当前 targetLang + 播放；作为新消息追加到 session |
| VM5 | 聊天区固定高度 | 进入 VoiceMode 观察聊天区 | 聊天区固定 65vh |
| VM6 | 空会话时隐藏 ➕ | 进入 VoiceMode，无历史消息 | 右下角无 ➕ 按钮 |
| VM7 | 有消息时显示 ➕ | 录音一条后 | 右下角出现浮动 ➕ 按钮 |
| VM8 | 点击 ➕ 开新会话 | 点击 ➕ | 气泡区清空，下次翻译开启新 session |

---

### 3.6 图片翻译

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| P1 | 打开相机 | Home 点击黑色取景框 | CameraCapture 打开，相机预览可见 |
| P2 | 拍照 | 点击圆形拍照按钮 | 显示预览，提供「重拍」和「使用照片」选项 |
| P3 | 重拍 | 预览页点击「重拍」 | 回到相机预览 |
| P4 | 使用照片翻译 | 点击「使用照片」 | 调用 OCR + LLM，自动检测语言并翻译，显示结果底卡 |
| P5 | 关闭相机 | 点击 ✕ 按钮 | 返回 Home，取景框恢复原样 |
| P6 | 拍照无文字 | 拍摄空白墙面 | 提示「未识别到文字」 |

---

### 3.7 翻译结果展示（Home_Result）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| R1 | 结果底卡滑入 | 翻译完成后 | 底卡从底部滑入（300ms ease-out） |
| R2 | 译文自动播放 | 识别与翻译**完成后**（非流式过程中） | 自动播放目标语 TTS 一次 |
| R3 | 下滑关闭底卡（桌面） | 在顶部灰色手柄条向下滑动超过约 80px | 底卡关闭，返回 Home |
| R3.1 | 下滑关闭底卡（移动端）| 在移动设备上，触摸把手向下滑动 | 底卡关闭，**背景页面不滚动**，无 pull-to-refresh |
| R4 | 点击返回关闭 | 结果页点击左上角「←」 | 清空结果，返回 Home |
| R5 | 上滑全屏 | 拖动底卡把手向上（若已实现） | 全屏展开翻译详情 |
| R6 | 相机画面始终可见 | 结果页 | 黑色取景框背景始终可见 |
| R7 | 下滑时 body 不滚动 | 打开底卡后下滑手柄 | `document.body` 临时 `overflow: hidden`，背景不跟随滚动 |
| R8 | 手柄区 touch-action | 检查手柄区 CSS | `touch-action: none` 生效 |

---

### 3.8 常用语（v1.3：2 行横滑 + 上限 10）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| PH1 | 点击常用语 → 目标语言为日语 | targetLang='ja'，Home 点击「多少钱」 | 弹 TranslationSheet 展示「いくらですか」+ 自动播放日语 TTS |
| PH2 | 点击常用语 → 目标语言为德语 | Settings 切 targetLang='de'，点击「多少钱」 | 弹 TranslationSheet 展示德语翻译 + 播放德语 TTS |
| PH3 | 多语言 lazy 缓存 | PH2 之后在 localStorage 检查 `traveltalk_phrases` | 对应 phrase 的 `translations` 同时含 `ja` 和 `de` 两项缓存 |
| PH4 | 再次点击命中缓存 | 回切 ja，点击同一条常用语 | 即时弹底卡（不再调 API），日语翻译立即展示 |
| PH5 | 横向滚动显示更多 | 常用语 >6 条，向右滑动 | 第 7-10 条滑入视野 |
| PH6 | 2 行布局 | 观察常用语区域 | 固定 2 行，横向滚动，无展开/收起 |
| PH7 | 打开管理页 | 点击 TopBar 右上角 ⚙ | 进入 Settings |
| PH8 | 添加常用语（只输原文） | Settings 点击「+ 添加常用语」，输入「你好」 | 新条目只带 `text: '你好'` + `source_lang: 'zh'`，`translations: {}` |
| PH9 | 新添加常用语首次点击自动翻译 | 刚添加「你好」后点击它 | 调用 llm-gateway 翻译 → 缓存 → 弹底卡 |
| PH10 | 删除常用语 | Settings 点击常用语右侧「-」 | 条目删除，列表更新 |
| PH11 | 满 10 条隐藏添加入口 | Settings 添加到 10 条 | Home/VoiceMode 常用语区无"+ 添加"入口，Settings 的"+ 添加常用语"按钮消失 |
| PH12 | 老数据迁移 | 上一版 localStorage 有 `translation: 'いくらですか', target_lang: 'ja'` | 首次读取时自动迁为 `translations: { ja: { translated: 'いくらですか' }}` |
| PH13 | 老数据迁移（>10 条） | localStorage 有 12 条常用语 | 读取时仅显示前 10 条，Settings 提示"精简" |
| PH14 | VoiceMode 内点击常用语 | VoiceMode 下点「多少钱」 | 弹底卡 + 播放；同时作为一条 `type:'phrase'` 消息追加到 currentSession |

---

### 3.9 历史会话（v1.3：跨模式 Session + 15min idle + 新对话）

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| H1 | 首次翻译自动创建 session | 清空 localStorage，Home 拍照翻译一次 | History 页里出现 1 条 session，含 1 条消息 |
| H2 | 同 session 跨模式累加 | H1 后切 VoiceMode 录 2 句，再切回 Home 点常用语 1 次 | 仍是 **1 条 session**，内含 4 条消息（1 photo + 2 voice + 1 phrase） |
| H3 | Home 15min idle 自动归档 | 连续翻译后等 16 分钟（或 mock 时钟），在 Home 再翻译 1 次 | 新建第 2 个 session，History 页里 2 条 |
| H4 | VoiceMode 不按时间切 | 在 VoiceMode 留 16 分钟后再录音 | **仍是同一 session**，不会自动切 |
| H5 | 手动点「➕ 新对话」 | VoiceMode 右下角点浮动 ➕ 按钮 | 气泡区清空；下次录音开新 session |
| H6 | 历史点击跳转并续写 | History 页点某条历史 → 跳 VoiceMode 展示其所有消息气泡 → 继续录音一条 | 新消息追加到该老 session；气泡列表含历史+新增 |
| H7 | 历史气泡 ▶ 播放正确语种 | H6 进入一个 zh↔de 历史，切全局 targetLang='ja'，点某条气泡 ▶ | 仍按消息原 targetLang（de）播放，不受全局切换影响 |
| H8 | 左滑删除会话 | History 页左滑历史条目 | 删除按钮出现，点击删除 |
| H9 | 无历史时显示 | 从未做过翻译 | 显示「暂无历史会话」 |
| H10 | lastMessage 预览 | 任意 session 显示在 History 列表 | 取最后一条 translatedText 前 50 字作为预览 |

---

### 3.10 模式切换

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| M1 | 拍照→语音模式 | TopBar 点击 🎙 | 进入 Voice Mode，隐藏取景框，显示聊天区 |
| M2 | 语音→拍照模式 | TopBar 点击 📷 | 返回 Home，显示取景框 |
| M3 | 模式图标高亮 | 切换模式后 | 当前模式图标高亮显示 |
| M4 | 模式切换保持 TopBar | 任意模式切换 | TopBar 始终可见，功能一致 |

---

### 3.11 PWA

| ID | 用例 | 操作步骤 | 预期结果 |
|----|------|----------|----------|
| PW1 | Service Worker 注册 | 首次加载 | `sw.js` 注册成功，离线可用 |
| PW2 | manifest | 加载时 | `/manifest.webmanifest` 包含正确字段 |
| PW3 | 添加到主屏幕 | iOS Safari → 分享 → 添加到主屏幕 | 可添加到桌面，图标和名称正确 |
| PW4 | 离线可用 | 飞行模式打开 App | 首页常用语和 UI 可正常显示 |

---

## 四、UI/UX 验收

### 4.1 颜色

| 元素 | 色值 | 验证 |
|------|------|------|
| 主背景 | `#F2EDE8` | CSS 检查 |
| 主色调（录音按钮） | `#D94F00` | 视觉确认 |
| 深色背景（选中） | `#000000` | CSS 检查 |
| 胶囊未选中 | `#1C1C1E` | CSS 检查 |
| 常用语气泡 | `#C5BEB6` | 视觉确认 |
| 播放按钮 | `#A8B5A0` | 视觉确认 |

### 4.2 字体

| 用途 | 字号 | 字重 |
|------|------|------|
| 语言胶囊 | 16px | 500 |
| 译文大字 | 22px | 600 |
| 原文小字 | 10px | 400 |
| 常用语 | 13px | 400 |
| section 标题 | 12px | 600 |

### 4.3 间距

| 元素 | 数值 |
|------|------|
| 页面左右边距 | 16px |
| 语言胶囊间距 | 12px |
| 常用语间距 | 8px |
| 常用语高度 | 36px |
| modeSwitcher 高度 | 44px |

---

## 五、自动化测试

### 5.1 单元测试覆盖目标

| 模块 | 覆盖率目标 |
|------|-----------|
| services/translation.ts | ≥80% |
| services/phrases.ts | ≥80% |
| hooks/useVoice.ts | ≥80% |
| stores/appStore.ts | ≥80% |
| types/index.ts | 100% |
| utils/languageDirection.ts | 100% |

### 5.2 E2E 测试（Playwright MCP）

关键流程自动化：

```bash
# 启动开发服务器
cd frontend && npm run dev

# 使用 Playwright MCP 进行测试
# 1. 调整浏览器尺寸为移动设备
browser_resize 390 844

# 2. 导航到应用
browser_navigate http://localhost:5173

# 3. 验证 TopBar 存在
browser_snapshot

# 4. 测试 Settings 页语言配对
browser_click "⚙"
browser_snapshot

# 5. 测试常用语横滑
browser_navigate http://localhost:5173
browser_evaluate "document.querySelector('.phrases-wrap').scrollLeft = 200"
browser_snapshot

# 6. 测试拍照翻译
browser_click "取景框"
browser_snapshot
```

---

## 六、测试进度

| 模块 | 状态 | 说明 |
|------|------|------|
| **v1.3 重构** | 🔄 待开发 | 基于 plan 文件的完整重构 |
| TopBar 导航 | 🔄 待开发 | 历史/设置/模式切换常驻顶栏 |
| Settings 页 | 🔄 待开发 | 语言配对 + 常用语管理 |
| History 页 | 🔄 待开发 | 从 Menu 拆分 |
| 自动语言检测 | 🔄 待开发 | 后端支持 auto + 前端 resolveTranslationDirection |
| 单 Pill 录音 | 🔄 待开发 | 替代双 pill，仅麦克风 icon |
| 常用语横滑 | 🔄 待开发 | 2 行固定 + 横向滚动 + 上限 10 |
| TranslationSheet 下滑修复 | 🔄 待开发 | preventDefault + body overflow:hidden |
| VoiceMode 65vh + ➕ 按钮 | 🔄 待开发 | 聊天区固定高度 + 右下角浮动新对话 |
| ModeSwitcher icon-only | 🔄 待开发 | 去掉文字，仅保留 📷/🎙 |
| 语音翻译 API | 🔄 待验证 | Supabase 函数需启动 |
| 图片翻译 API | 🔄 待验证 | 需要真实图片测试 |
| PWA 离线 | 🔄 待验证 | 需部署后测试 |

---

## 七、已知问题

| 问题 | 说明 | 状态 |
|------|------|------|
| 长按语言菜单无法选中 | v1.2 双 pill 长按菜单交互问题 | v1.3 移除双 pill 解决 |
| 翻译底卡下滑连带背景滚动 | TranslationSheet 下滑时背景页面跟随滚动 | v1.3 修复：preventDefault + body overflow:hidden |
| 常用语挤占取景框空间 | 展开/收起逻辑复杂，占用过多空间 | v1.3 改为 2 行横滑 |
| VoiceMode 布局空旷 | 聊天区高度不固定，视觉不稳定 | v1.3 固定 65vh |
| 底部模式按钮冗余文字 | ModeSwitcher 文字占用空间 | v1.3 改为 icon-only |
| 缺少历史/设置快速入口 | 需要进入 Menu 才能访问 | v1.3 TopBar 常驻 |
| 两个语言 pill 冗余 | 模型支持自动检测，双 pill 交互复杂 | v1.3 单 pill + auto 检测 |
| 语音翻译 API | `voice-translate` Edge Function 未本地启动 | 待验证 |
| 历史会话存储 | `sessions` 数据结构存在，存储逻辑未实现 | 待开发 |

