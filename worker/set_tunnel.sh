#!/bin/bash
set -e

# 檢查 .env 檔案是否存在
if [ ! -f ".env" ]; then
  echo "Error: .env file not found."
  echo "Please create it with CF_API_TOKEN, CF_ACCOUNT_ID, and TUNNEL_NAME."
  exit 1
fi

# 載入 .env 檔案中的變數
# 這會讀取 .env，忽略 # 註解，並匯出變數
export $(grep -v '^#' .env | xargs)


# --- 1. 呼叫 API 建立 Tunnel ---
# 參考: https://developers.cloudflare.com/api/operations/cloudflare-tunnel-create-a-cloudflare-tunnel
CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"name":"'$TUNNEL_NAME'"}')

# --- 2. 解析 API 回應，取得 Tunnel ID ---
SUCCESS=$(echo "$CREATE_RESPONSE" | jq -r .success)
if [ "$SUCCESS" != "true" ]; then
    echo "Error: Failed to create tunnel."
    echo "API Response:"
    echo "$CREATE_RESPONSE" | jq
    exit 1
fi

TUNNEL_ID=$(echo "$CREATE_RESPONSE" | jq -r .result.id)
echo "Successfully created tunnel. Tunnel ID: $TUNNEL_ID"

# --- 3. 取得該 Tunnel 的 Connector Token ---
# 這是您在教學中看到的步驟，用這個 Token 來啟動 cloudflared
# 參考: https://developers.cloudflare.com/api/operations/cloudflare-tunnel-get-a-cloudflare-tunnel-token
echo "Retrieving token for Tunnel ID: $TUNNEL_ID..."
TOKEN_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" \
     -H "Authorization: Bearer $CF_API_TOKEN")

TUNNEL_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r .result)

if [ -z "$TUNNEL_TOKEN" ] || [ "$TUNNEL_TOKEN" == "null" ]; then
     echo "Error: Failed to get tunnel token."
     echo "API Response:"
     echo "$TOKEN_RESPONSE" | jq
     exit 1
fi

echo "Successfully retrieved tunnel token."

# --- 4. 顯示最終執行的命令 ---
echo "------------------------------------------------------"
echo "✅ Setup complete. To run your tunnel, use:"
echo ""
echo "   cloudflared tunnel run --token $TUNNEL_TOKEN $TUNNEL_ID"
echo ""
echo "------------------------------------------------------"
