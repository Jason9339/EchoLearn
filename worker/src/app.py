# app.py (Main Application File)
from flask import Flask
from flask_cors import CORS

# 1. 從您的 routes 檔案 import 那個 blueprint
from routes.audio import audio_bp

# 2. 建立 App
app = Flask(__name__)

# 3. 設定 App 層級的 CORS
#    注意：CORS 應該在主 app 上設定，這樣才能套用到所有 blueprint
cors_origins = ["https://echo-learn.vercel.app", "localhost:3000"]
CORS(app, origins=cors_origins)
# 註：您可以簡化 CORS 設定，因為 Vercel API 會幫您過濾 /api/worker
# 您的 Python 只需要允許 Vercel 即可
# 但如果您想更嚴謹，可以保留 resources={r"/worker/*": {}}


app.register_blueprint(audio_bp, url_prefix='/worker/audio')

# 4. 在應用啟動時初始化 Supabase 客戶端（避免每次請求都初始化）
print("🔧 初始化 Supabase 客戶端...")
from services.supabase_client import get_supabase_client
try:
    supabase_client = get_supabase_client()
    print("✅ Supabase 客戶端初始化完成")
except Exception as e:
    print(f"⚠️  警告：Supabase 客戶端初始化失敗: {e}")
    print("   評分快取功能將無法使用，但不影響評分功能")

# 5. 啟動器
if __name__ == '__main__':
    print("可用的路由:")
    print(app.url_map) # 這會印出所有已註冊的路由表，方便除錯
    app.run(host='0.0.0.0', port=5001, debug=True)
