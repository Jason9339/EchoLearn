#!/bin/bash
# set -e


# 檢查 .env 檔案是否存在
if [ ! -f ".env" ]; then
  echo "Error: .env file not found."
  echo "Please create it with CF_API_TOKEN, CF_ACCOUNT_ID, and TUNNEL_NAME."
  exit 1
fi

# --- 載入變數 (假設您使用 .env) ---
export $(grep -v '^#' .env | xargs)
# 確保 .env 包含:
# CF_API_TOKEN, CF_ACCOUNT_ID, TUNNEL_ID,
# PUBLIC_HOSTNAME, LOCAL_SERVICE

echo "Configuring Ingress for Tunnel ID: $TUNNEL_ID..."
echo "Routing $PUBLIC_HOSTNAME -> $LOCAL_SERVICE"

# --- 使用 'here document' (HEREDOC) 來建立 JSON ---
# 這比在 bash 中手動拼字串更安全、更易讀
read -r -d '' JSON_PAYLOAD << EOM
{
  "config": {
    "ingress": [
      {
        "hostname": "$PUBLIC_HOSTNAME",
        "service": "$LOCAL_SERVICE"
      },
      {
        "service": "http_status:404"
      }
    ]
  }
}
EOM
# ---------------------------------------------------

# 呼叫 API (注意是 PUT，表示「覆蓋」)
# 參考: https://developers.cloudflare.com/api/operations/cloudflare-tunnel-update-a-cloudflare-tunnel-configuration
API_RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data "$JSON_PAYLOAD")

# 檢查 API 回應
SUCCESS=$(echo "$API_RESPONSE" | jq -r .success)

if [ "$SUCCESS" != "true" ]; then
    echo "Error: Failed to configure tunnel ingress."
    echo "API Response:"
    echo "$API_RESPONSE" | jq
    exit 1
fi

echo "✅ Successfully configured tunnel ingress."
