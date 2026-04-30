# TravelTalk Subagent-Driven Development Plan

## 使用条件

当已经有明确实现计划，并且任务之间文件边界相对独立时，使用 subagent-driven-development。每个任务使用 fresh implementer subagent，并在完成后依次进行：

1. 规格一致性评审。
2. 代码质量评审。

不要在同一个任务的规格评审通过前启动代码质量评审。不要并行派发多个会改同一文件集的实现 subagent。

## 项目模块拆分矩阵

| 模块 | 典型文件/边界 | 可拆任务 | 主要风险 | 最小验证 |
|---|---|---|---|---|
| Voice 前端 | `frontend/src/hooks/useVoiceTranslate.ts`、`usePcmStream.ts`、`services/translation.ts` | 流式状态、降级路径、TTS 播放时机、取消/错误处理 | 录音状态与请求流生命周期耦合 | `npm run test`、浏览器麦克风 smoke |
| Voice Edge | `supabase/functions/voice-translate` | NDJSON 协议、Gummy WebSocket、尾部静音、TTS complete 帧 | 外部服务时序和末句丢失 | contract fixture、本地 serve smoke |
| Image 前端 | `PhotoOverlay`、`CameraCapture`、bbox utils、store | OCR region 映射、原图/译文切换、删除/替换照片 | bbox 映射随图片尺寸偏移 | unit test、移动截图 |
| Image Edge | `supabase/functions/image-translate` | qwen-vl OCR、批量翻译 JSON、fallback | LLM JSON 解析和 OCR 空结果 | fixture contract |
| Phrases | `services/phrases.ts`、Dexie schema、Settings/Home phrase UI | 上限 10 条、多语言 lazy cache、老数据迁移 | 本地数据迁移破坏用户短语 | unit test |
| History | session utils、History 页面、VoiceMode 气泡 | 15min idle、新对话、历史续写、播放语种 | session 边界和全局语言切换耦合 | unit test + 关键交互 |
| Settings/TopBar | Settings、TopBar、store | 语言配对持久化、模式切换 | PRD v1.4 与旧测试不一致 | component test |
| PWA/Build | Vite PWA、manifest、service worker | 离线缓存、图标、安装体验 | 缓存旧资源导致回归 | `npm run build`、离线 smoke |
| Docs/Tests | `docs/test-plan.md`、Memory Bank | v1.4 用例更新、验收矩阵 | 文档滞后误导 agent | 文档交叉检查 |

## 推荐执行顺序

1. 文档与测试计划对齐：把 `docs/test-plan.md` 升级到 v1.4。
2. 语音协议契约：固定 NDJSON `delta/complete/error` 形状。
3. 图片覆盖层契约：固定 `regions` 和 bbox 映射测试。
4. 本地数据稳定性：常用语与历史会话迁移/边界测试。
5. 移动端交互验收：TopBar、双 pill、TranslationSheet、PhotoOverlay。
6. PWA 与发布质量门。

## Subagent 任务卡模板

```markdown
## Implementer Task

Context:
- Project: TravelTalk PWA
- Relevant docs: <列出具体 docs/memory-bank 文件>
- Scope files: <允许修改的文件>
- Out of scope: <禁止修改的文件或行为>

Spec:
- <完整规格，不让 subagent 自己翻计划文件>

Completion:
- <完成条件>
- <必须运行的验证命令>
- <需要更新的文档>

Risk:
- <一个主要风险>

Report format:
- status:
- summary:
- tests:
- changed_files:
- risks:
- next_actions:
```

## 规格评审模板

```markdown
## Spec Review

Review only whether implementation matches the task spec.

Return:
- status: approved | changes_requested
- missing_requirements:
- extra_behavior:
- evidence:
- required_fixes:
```

## 代码质量评审模板

```markdown
## Code Quality Review

Review invariants, edge cases, error boundaries, security assumptions, and hidden coupling.
Ignore pure style issues already covered by lint/formatter.

Return:
- status: approved | changes_requested
- findings:
- tests_or_verification_gaps:
- required_fixes:
```

## 不适合拆给 subagent 的情况

- 需求仍然模糊，完成标准无法写成可观察条件。
- 同一文件需要多个任务并发修改。
- 涉及生产部署、密钥、数据库破坏性迁移。
- 需要真实旅行场景或第三方服务稳定性判断，且没有可用 fixture。

