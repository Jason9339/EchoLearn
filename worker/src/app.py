import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'FreeVC'))

from flask import Flask
from flask_cors import CORS

# 1. 從您的 routes 檔案 import 那個 blueprint
from routes.example import example_worker_bp
from routes.audio import audio_bp
from routes.voice_conversion import voice_conversion_bp
from services.voice_conversion_service import load_models

# 2. 建立 App
app = Flask(__name__)

# 3. 設定 App 層級的 CORS
#    注意：CORS 應該在主 app 上設定，這樣才能套用到所有 blueprint
cors_origins = ["https://echo-learn.vercel.app", "localhost:3000"]
CORS(app, origins=cors_origins) 
# 註：您可以簡化 CORS 設定，因為 Vercel API 會幫您過濾 /api/worker
# 您的 Python 只需要允許 Vercel 即可
# 但如果您想更嚴謹，可以保留 resources={r"/worker/*": {}}


app.register_blueprint(example_worker_bp, url_prefix='/worker')
app.register_blueprint(audio_bp, url_prefix='/worker/audio')
app.register_blueprint(voice_conversion_bp, url_prefix='/worker/voice-conversion')

# 5. 啟動器
if __name__ == '__main__':
    # Get the base directory (worker/src/)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(base_dir, "FreeVC/configs/freevc.json")
    checkpoint_path = os.path.join(base_dir, "FreeVC/checkpoints/freevc.pth")

    with app.app_context():
        load_models(config_path, checkpoint_path)
    print("可用的路由:")
    print(app.url_map) # 這會印出所有已註冊的路由表，方便除錯
    app.run(host='0.0.0.0', port=5001, debug=True)