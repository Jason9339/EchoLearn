# 語音功能開發指南

## 簡介

這份文件說明如何在 EchoLearn Worker 中實作語音處理功能。

## 現有架構

```
worker/
├── src/
│   ├── app.py                    # Flask 主應用
│   ├── routes/
│   │   ├── example.py            # 範例路由
│   │   └── audio.py              # 語音處理路由（待實作）
│   └── services/
│       └── audio_service.py      # 語音處理核心邏輯（待實作）
├── temp/                         # 臨時檔案存放
├── tests/                        # 功能測試
└── requirement.txt               # Python 依賴套件
```

### 架構說明

- **Routes 層** ([src/routes/audio.py](src/routes/audio.py)): 處理 HTTP 請求、參數驗證、回應格式化
- **Services 層** ([src/services/audio_service.py](src/services/audio_service.py)): 核心業務邏輯、API 整合

## 語音功能模板

### 1. 語音轉文字 (Speech-to-Text)
- **端點**: `POST /worker/audio/transcribe`
- **功能**: 將音訊檔案轉換為文字
- **建議工具**: OpenAI Whisper API

### 2. 發音評分 (Pronunciation Assessment)
- **端點**: `POST /worker/audio/pronunciation`
- **功能**: 分析發音並給予評分回饋
- **建議工具**: Azure Speech Service

### 3. 健康檢查
- **端點**: `GET /worker/audio/health`
- **功能**: 檢查服務狀態

## 如何開始實作

### Step 1: 查看現有模板

- 查看 [src/routes/audio.py](src/routes/audio.py) - API 端點結構
- 查看 [src/services/audio_service.py](src/services/audio_service.py) - 核心邏輯模板

### Step 2: 安裝需要的套件

根據你要使用的 API，添加相應的套件到 `requirement.txt`：

```bash
# 範例：使用 OpenAI Whisper
pip install openai

# 或使用 Azure Speech Service
pip install azure-cognitiveservices-speech
```

### Step 3: 實作 Service 層

在 [src/services/audio_service.py](src/services/audio_service.py) 中實作核心功能：

```python
def transcribe_audio(file_path: str, language: str = 'en') -> dict:
    """語音轉文字"""
    # 實作範例（使用 OpenAI Whisper）
    import openai

    with open(file_path, 'rb') as audio_file:
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file,
            language=language
        )

    return {
        'text': transcript.text,
        'confidence': 0.95
    }
```

### Step 4: 完善 Routes 層

在 [src/routes/audio.py](src/routes/audio.py) 中添加檔案處理邏輯：

```python
# 儲存上傳的檔案
import os
from werkzeug.utils import secure_filename

file_path = os.path.join('temp', secure_filename(file.filename))
file.save(file_path)

# 呼叫 service 層
result = transcribe_audio(file_path, language)
```

### Step 5: 測試 API

```bash
# 啟動服務
cd /home/jason/EchoLearn/worker
source .venv/bin/activate
python3 src/app.py

# 測試健康檢查
curl http://localhost:5001/worker/audio/health

# 測試語音轉文字
curl -X POST http://localhost:5001/worker/audio/transcribe \
  -F "file=@test.mp3" \
  -F "language=en"

# 測試發音評分
curl -X POST http://localhost:5001/worker/audio/pronunciation \
  -F "file=@test.mp3" \
  -F "reference_text=Hello world" \
  -F "language=en"
```