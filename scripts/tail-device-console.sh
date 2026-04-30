#!/usr/bin/env bash
# tail-device-console.sh
#
# 通过 xcrun devicectl 实时 stream 真实 iPhone 上 Safari/PWA 的 console 日志
# 包含前端 console.log / console.error 输出，用于真机 bug 复现时直接看链路日志。
#
# 用法:
#   ./scripts/tail-device-console.sh               # 默认设备（活点地图 iPhone 16）
#   DEVICE_ID=<UDID> ./scripts/tail-device-console.sh   # 指定设备
#
# 过滤关键字（只看 TravelTalk 相关）:
#   ./scripts/tail-device-console.sh | grep -E "\[WS\]|\[TTS\]|\[FN\]|voice|translate"

set -euo pipefail

DEVICE_ID="${DEVICE_ID:-00008140-001641D411E3001C}"

# ── 检查 xcrun devicectl ───────────────────────────────────────────────────
if ! command -v xcrun &>/dev/null; then
  echo "❌  xcrun 不存在，请安装 Xcode Command Line Tools。" >&2
  exit 1
fi

# ── 验证设备在线 ───────────────────────────────────────────────────────────
echo "🔍  检查设备连接..."
if ! xcrun devicectl list devices 2>/dev/null | grep -q "$DEVICE_ID"; then
  echo "⚠️  设备 $DEVICE_ID 未找到。已连接设备列表："
  xcrun devicectl list devices 2>/dev/null | grep -v "^$" | tail -20
  echo ""
  echo "请用 USB 连接 iPhone 并解锁，然后重试。"
  exit 1
fi
echo "✅  设备已连接: $DEVICE_ID"
echo ""
echo "📱  开始 stream Safari/PWA console 日志（Ctrl+C 停止）"
echo "    提示：在 iPhone 上打开 PWA 并操作，日志会实时出现在这里"
echo "──────────────────────────────────────────────────────────────────────"

# ── Stream 日志 ────────────────────────────────────────────────────────────
# 过滤 WebContent（Safari 渲染进程）和 MobileSafari 的 console 消息
xcrun devicectl device console --device "$DEVICE_ID" 2>&1 | \
  grep --line-buffered -iE \
    "WebContent|MobileSafari|console-message|JSContext|\[WS\]|\[TTS\]|\[FN\]|traveltalk|voice.translate|llm.gateway|image.translate" \
  || true

echo ""
echo "📋  日志 stream 已结束"
