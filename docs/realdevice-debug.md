# 真机调试 SOP

## 前置条件

```
iPhone:  Settings -> Safari -> Advanced -> Web Inspector  ON
iPhone:  USB 接 Mac -> 弹"信任此电脑" -> 选信任 + 输密码
Mac:     Safari -> Settings -> Advanced -> Show Develop menu in menu bar
```

## Web Inspector 连接

```
Mac:  Safari -> Develop -> <iPhone name> -> 选 PWA tab
      -> Web Inspector 打开：Network / Console / Sources / Storage / Application
```

PWA 安装后（加到主屏幕）也能 inspect，前提是后台进程没被杀。

## Cloudflare Quick Tunnel SOP

```bash
# 1. 杀旧 tunnel
pkill -f cloudflared

# 2. 重启 quick tunnel，拿新 URL
cloudflared tunnel --url http://localhost:5173 > /tmp/cf-tunnel.log 2>&1 &
sleep 3
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1
```

iPhone 上：长按桌面 PWA -> 删除 -> Safari 打开新 URL -> 分享菜单 -> "添加到主屏幕"。

## 真机 Console 日志 Stream

```bash
DEVICE_ID="00008140-001641D411E3001C"
xcrun devicectl device console --device "$DEVICE_ID" 2>&1 | \
  grep --line-buffered -E "WebContent|MobileSafari|console-message"
```

## 手动 E2E 检查清单

每次出 bug 跑一遍：

- [ ] Network tab 录制中
- [ ] 触发问题动作（点 pill / 拍照 / 点常用语）
- [ ] 找到 voice-translate / image-translate 那次 fetch
  - Headers: Request URL（query 参数 sourceLang/targetLang 对吗？）
  - Headers: Authorization 有吗？
  - Body: payload JSON 完整结构
  - Response: NDJSON 内 complete event 的 originalText/translatedText/audioUrl
- [ ] Console: 看是否有红字错误（CORS / 网络 / 解析）
- [ ] Storage > Local Storage: 看 traveltalk-store 里 languagePair 是不是预期值
- [ ] Storage > IndexedDB: 看 phrases 库里 translations[targetLang] 是不是有 audioDataUrl
- [ ] Application > Service Workers: 看 PWA SW 是 active 还是 redundant

## Edge Function 日志

Dashboard 直链：
- voice-translate: https://supabase.com/dashboard/project/eulnavmuqtnbtwcwlmzp/functions/voice-translate/logs
- image-translate: https://supabase.com/dashboard/project/eulnavmuqtnbtwcwlmzp/functions/image-translate/logs
- llm-gateway: https://supabase.com/dashboard/project/eulnavmuqtnbtwcwlmzp/functions/llm-gateway/logs

或在前端 voice-translate URL 加 `?debug=true`，complete 事件会带 `rawMessages[]`（Gummy 全部回包）。
