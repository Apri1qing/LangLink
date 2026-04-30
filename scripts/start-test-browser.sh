#!/bin/bash
# start-test-browser.sh
# 启动支持麦克风权限的自动化测试浏览器
#
# 用法：
#   ./scripts/start-test-browser.sh            # 默认打开 localhost:5173
#   ./scripts/start-test-browser.sh http://... # 打开指定 URL

set -e

URL="${1:-http://localhost:5173}"
CDP_PORT=9222
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE_DIR="/tmp/chrome-traveltalk-test"

echo "==> 关闭旧的 Chrome 调试实例..."
pkill -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null || true
sleep 1

echo "==> 启动 Chrome（自动授权 + 真实麦克风）..."
"$CHROME" \
  --remote-debugging-port=${CDP_PORT} \
  --user-data-dir="${PROFILE_DIR}" \
  --auto-accept-camera-and-microphone-capture \
  --enable-features=WebRtcHideLocalIpsWithMdns \
  --no-first-run \
  --no-default-browser-check \
  --disable-sync \
  about:blank &

# 等待 CDP 就绪
echo -n "==> 等待 CDP..."
for i in $(seq 1 10); do
  sleep 1
  if curl -s "http://localhost:${CDP_PORT}/json/version" > /dev/null 2>&1; then
    echo " 就绪"
    break
  fi
  echo -n "."
done

echo "==> 打开目标页面: ${URL}"
browser-use --cdp-url "http://localhost:${CDP_PORT}" open "${URL}"

echo ""
echo "==> 验证麦克风权限（实际调用 getUserMedia）..."
sleep 2

# Inject async test via script that stores result in window global
browser-use --cdp-url "http://localhost:${CDP_PORT}" eval \
  "navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{window.__micOK='tracks:'+s.getAudioTracks().length;s.getTracks().forEach(t=>t.stop())}).catch(e=>{window.__micOK='error:'+e.name})" \
  2>/dev/null || true

sleep 2
RESULT=$(browser-use --cdp-url "http://localhost:${CDP_PORT}" eval "window.__micOK || 'pending'" 2>&1)

echo "    getUserMedia 结果: ${RESULT}"

if echo "${RESULT}" | grep -q "tracks:"; then
  echo ""
  echo "✅ 成功！麦克风可正常使用"
  echo "   CDP 地址: http://localhost:${CDP_PORT}"
  echo "   后续命令: browser-use --cdp-url http://localhost:${CDP_PORT} <command>"
else
  echo ""
  echo "❌ getUserMedia 失败: ${RESULT}"
  echo "   提示：可尝试 browser-use connect 使用已登录的真实 Chrome"
  exit 1
fi
