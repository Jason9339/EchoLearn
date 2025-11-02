#!/bin/bash
set -e

# --- 載入變數 (假設您使用 .env) ---
export $(grep -v '^#' .env | xargs)
# 確保 .env 包含:
# CF_API_TOKEN, ZONE_ID, TUNNEL_ID, PUBLIC_HOSTNAME

echo "Creating DNS CNAME record for $PUBLIC_HOSTNAME..."

# --- 這是 CNAME 紀錄的目標位址 ---
TUNNEL_CNAME_TARGET="$TUNNEL_ID.cfargotunnel.com"

# --- JSON 酬載 ---
read -r -d '' JSON_PAYLOAD << EOM
{
  "type": "CNAME",
  "name": "$PUBLIC_HOSTNAME",
  "content": "$TUNNEL_CNAME_TARGET",
  "ttl": 1,
  "proxied": true
}
EOM
# --------------------

# 呼叫 API (POST)
# 參考: https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
API_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data "$JSON_PAYLOAD")

# 檢查 API 回應
SUCCESS=$(echo "$API_RESPONSE" | jq -r .success)

if [ "$SUCCESS" != "true" ]; then
    # 檢查是否「已存在」
    ALREADY_EXISTS=$(echo "$API_RESPONSE" | jq -r '.errors[0].code' | grep "81041")
    if [ -n "$ALREADY_EXISTS" ]; then
        echo "⚠️ Warning: DNS record already exists. Assuming it's correct."
    else
        echo "Error: Failed to create DNS record."
        echo "API Response:"
        echo "$API_RESPONSE" | jq
        exit 1
    fi
else
    echo "✅ Successfully created DNS record."
fi
