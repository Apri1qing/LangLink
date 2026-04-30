#!/usr/bin/env bash
# tail-edge-logs.sh
#
# Tail Supabase Edge Function logs via the Supabase Management REST API.
# 用法:
#   ./scripts/tail-edge-logs.sh voice-translate      # 最近 5 min
#   ./scripts/tail-edge-logs.sh image-translate 15   # 最近 15 min
#   ./scripts/tail-edge-logs.sh llm-gateway 60       # 最近 60 min
#
# 前提:
#   SUPABASE_ACCESS_TOKEN 环境变量（或写在 ~/.supabase/access-token）
#   jq 已安装（brew install jq）

set -euo pipefail

FUNCTION="${1:-voice-translate}"
MINUTES="${2:-5}"
PROJECT_REF="eulnavmuqtnbtwcwlmzp"

# ── 取 access token ────────────────────────────────────────────────────────
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN_FILE="$HOME/.supabase/access-token"
  if [[ -f "$TOKEN_FILE" ]]; then
    TOKEN="$(cat "$TOKEN_FILE")"
  fi
fi
if [[ -z "$TOKEN" ]]; then
  echo "❌  缺少 SUPABASE_ACCESS_TOKEN。请运行 'supabase login' 或设置环境变量。" >&2
  exit 1
fi

# ── 时间范围 ───────────────────────────────────────────────────────────────
START_TS="$(date -u -v"-${MINUTES}M" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
  || date -u --date="${MINUTES} minutes ago" '+%Y-%m-%dT%H:%M:%SZ')"
END_TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "📋  Edge Function: $FUNCTION"
echo "⏱   时间范围: $START_TS → $END_TS"
echo "──────────────────────────────────────────────────────────────────────"

# ── API 调用 ───────────────────────────────────────────────────────────────
URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/functions.logs"
URL+="?function_id=${FUNCTION}"
URL+="&iso_timestamp_start=${START_TS}"
URL+="&iso_timestamp_end=${END_TS}"
URL+="&limit=500"

RESPONSE="$(curl -sf \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  "$URL" 2>&1)" || {
    echo "❌  API 请求失败: $RESPONSE" >&2
    exit 1
  }

# ── 格式化输出 ─────────────────────────────────────────────────────────────
if command -v jq &>/dev/null; then
  echo "$RESPONSE" | jq -r '
    .result[]? |
    "\(.timestamp // "?") [\(.level // "info" | ascii_upcase)] \(.event_message // .message // "")"
  ' 2>/dev/null || echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi

echo ""
echo "✅  完成。按 ↑ 重新拉取最新日志，或：./scripts/tail-edge-logs.sh $FUNCTION $MINUTES"
