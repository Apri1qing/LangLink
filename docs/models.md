# 阿里云模型配置（TravelTalk）

| 功能            | 模型                  | 端点（简称）              | 配置位置                       |
|----------------|-----------------------|--------------------------|-------------------------------|
| 文本翻译        | qwen-plus             | compatible-mode/chat     | _shared/models.ts -> DASHSCOPE.text |
| 图片 OCR       | qwen-vl-ocr-latest    | multimodal-generation    | _shared/models.ts -> DASHSCOPE.ocr |
| 语音 ASR + 翻译 | gummy-realtime-v1     | api-ws/inference (WS)    | _shared/models.ts -> DASHSCOPE.asr |
| 语音 TTS       | qwen3-tts-flash       | multimodal-generation    | _shared/models.ts -> DASHSCOPE.tts |

唯一密钥：`DASHSCOPE_API_KEY`（Supabase Edge Function secret，前端不可见）。

要换模型？改 `supabase/functions/_shared/models.ts` 一处即可，无需 env 操作。
