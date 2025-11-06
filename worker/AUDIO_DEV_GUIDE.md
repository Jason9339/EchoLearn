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

## 已實作功能

### Voice Conversion (語音轉換) ✅
- **端點**: `POST /worker/voice-conversion/convert`
- **功能**: 將來源音訊的聲音轉換成目標說話者的聲音
- **工具**: FreeVC
- **狀態**: 已完成

**測試範例：**
```bash
# 測試語音轉換
curl -X POST http://localhost:5001/worker/voice-conversion/convert \
  -F "source_audio=@temp/source.wav" \
  -F "target_audio=@temp/target.wav" \
  -o converted_output.wav

# 檢查輸出檔案
file converted_output.wav
# 輸出: RIFF (little-endian) data, WAVE audio, IEEE Float, mono 16000 Hz
```

## 語音功能模板

### 1. 語音轉文字 (Speech-to-Text)
- **端點**: `POST /worker/audio/transcribe`
- **功能**: 將音訊檔案轉換為文字
- **建議工具**: OpenAI Whisper API
- **狀態**: 待實作

### 2. 發音評分 (Pronunciation Assessment)
- **端點**: `POST /worker/audio/pronunciation`
- **功能**: 分析發音並給予評分回饋
- **建議工具**: Azure Speech Service
- **狀態**: 待實作

### 3. 健康檢查
- **端點**: `GET /worker/audio/health`
- **功能**: 檢查服務狀態
- **狀態**: 已實作

**測試範例：**
```bash
# 測試健康檢查
curl http://localhost:5001/worker/audio/health
```

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

### Step 4: 撰寫測試檔案

在 `tests/` 資料夾中新增測試檔案來測試你的 service 函數：

**範例：`tests/test_audio_service.py`**

```python
"""
測試語音處理服務
"""
import os
import sys

# 添加 src 到路徑，讓我們可以 import service
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../src'))

from services.audio_service import transcribe_audio, analyze_pronunciation


def test_transcribe_audio():
    """測試語音轉文字功能"""
    print("=== 測試語音轉文字 ===")

    # 使用 temp 資料夾中的測試音檔
    test_audio_path = os.path.join(os.path.dirname(__file__), '../temp/test_audio.wav')

    if not os.path.exists(test_audio_path):
        print(f"⚠️  測試音檔不存在: {test_audio_path}")
        print("請先將測試音檔放入 worker/temp/ 資料夾")
        return

    # 呼叫你實作的 function
    result = transcribe_audio(test_audio_path, language='en')

    # 輸出結果
    print(f"✅ 轉錄文字: {result['text']}")
    print(f"✅ 信心度: {result['confidence']}")
    print()


def test_analyze_pronunciation():
    """測試發音評分功能"""
    print("=== 測試發音評分 ===")

    test_audio_path = os.path.join(os.path.dirname(__file__), '../temp/test_pronunciation.wav')
    reference_text = "Hello, how are you?"

    if not os.path.exists(test_audio_path):
        print(f"⚠️  測試音檔不存在: {test_audio_path}")
        return

    # 呼叫你實作的 function
    result = analyze_pronunciation(test_audio_path, reference_text, language='en')

    # 輸出結果
    print(f"✅ 總分: {result['score']}")
    print(f"✅ 準確度: {result['feedback']['accuracy']}")
    print(f"✅ 流暢度: {result['feedback']['fluency']}")
    print(f"✅ 完整度: {result['feedback']['completeness']}")
    print()


if __name__ == '__main__':
    # 執行測試
    test_transcribe_audio()
    test_analyze_pronunciation()
    print("✅ 所有測試完成")
```

**執行測試：**

```bash
cd worker
source .venv/bin/activate
python tests/test_audio_service.py
```

**測試音檔準備：**
- 將測試用的音檔放在 `worker/temp/` 資料夾
- 例如：`worker/temp/test_audio.wav`, `worker/temp/test_pronunciation.wav`
- temp 資料夾已經在 .gitignore 中，不會被提交

### Step 5: 完善 Routes 層（選擇性）

**注意：Routes 層已經由後端架設者處理好，一般情況下你不需要修改**

如果需要調整 API 參數，可以在 [src/routes/audio.py](src/routes/audio.py) 中修改：

```python
# 儲存上傳的檔案
import os
from werkzeug.utils import secure_filename

file_path = os.path.join('temp', secure_filename(file.filename))
file.save(file_path)

# 呼叫 service 層
result = transcribe_audio(file_path, language)
```

### Step 6: 測試 API（選擇性）

**注意：這一步是測試完整的 HTTP API，通常由後端架設者負責**

```bash
# 啟動服務
cd worker
source .venv/bin/activate
python src/app.py

# 測試健康檢查
curl http://localhost:5001/worker/audio/health

# 測試語音轉文字
curl -X POST http://localhost:5001/worker/audio/transcribe \
  -F "file=@temp/test.wav" \
  -F "language=en"

# 測試發音評分
curl -X POST http://localhost:5001/worker/audio/pronunciation \
  -F "file=@temp/test.wav" \
  -F "reference_text=Hello world" \
  -F "language=en"
```