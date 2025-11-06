export $(grep -v '^#' .env | xargs)

cloudflared tunnel run --token $TUNNEL_TOKEN $TUNNEL_ID
