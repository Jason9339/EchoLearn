# 語音相似度評估模組

## 🎯 重要：兩種 Embedding 類型

本專案提供**兩種**語音相似度評估模組：

### 1️⃣ Speaker Embedding (本文件)
- **關注**: 👤 **誰在說話**（聲音特徵、聲紋）
- **檔案**: `eval_embedding_voice_similarity.py`
- **用途**: 說話者識別、聲紋認證、說話者分離

### 2️⃣ Content Embedding 
- **關注**: 💬 **說了什麼**（語義內容、音素）
- **檔案**: `eval_content_embedding_similarity.py`
- **用途**: 語音辨識、內容搜索、重複內容檢測
- **文檔**: 請參考 `README_CONTENT_SIMILARITY.md`

> 💡 **快速選擇**:
> - 要判斷「是否為同一個人」→ 使用 **Speaker Embedding**（本模組）
> - 要判斷「是否說了相同內容」→ 使用 **Content Embedding**
> - 詳細對照請參考 `EMBEDDING_OVERVIEW.md`

---

## 白話大綱
- 先安裝環境。
- 去 `example_test_eval_embedding_voice_similarity.py` 改音檔位置。
- 執行 python tests/example_test_eval_embedding_voice_similarity.py


## 簡介

此模組使用 SpeechBrain 的 ECAPA-TDNN 預訓練模型來計算兩個音檔之間的語音相似度。透過計算語音 embedding 的餘弦相似度，可以評估兩段語音是否來自同一說話者或語音特徵是否相似。

## 檔案說明

- **`eval_embedding_voice_similarity.py`**: 核心功能模組
  - `VoiceSimilarityEvaluator`: 語音相似度評估器類別
  - `evaluate_voice_similarity()`: 便利函數，快速計算相似度

- **`example_test_eval_embedding_voice_similarity.py`**: 測試範例
  - 展示如何在 app.py 中引用此模組
  - 包含多種測試案例

## 安裝依賴

```bash
cd worker
pip install -r requirement.txt
```

主要依賴套件：
- `speechbrain` (從 GitHub develop 分支安裝)
- `torch`
- `soundfile` (用於音訊載入)
- 其他依賴見 `requirement.txt`

## 使用方式

### 方法 1: 使用便利函數 (推薦)

```python
from tests.eval_embedding_voice_similarity import evaluate_voice_similarity

# 計算兩個音檔的相似度
result = evaluate_voice_similarity('audio1.wav', 'audio2.wav')

print(result['similarity_score'])  # 輸出: 0-100 分
print(result['status'])            # 輸出: 'success' 或 'error'
```

### 方法 2: 使用評估器類別 (批量處理)

```python
from tests.eval_embedding_voice_similarity import VoiceSimilarityEvaluator

# 建立評估器 (模型只載入一次)
evaluator = VoiceSimilarityEvaluator()

# 計算多個音檔的相似度
score1 = evaluator.calculate_similarity('audio1.wav', 'audio2.wav')
score2 = evaluator.calculate_similarity('audio1.wav', 'audio3.wav')
score3 = evaluator.calculate_similarity('audio1.wav', 'audio4.wav')

print(f"相似度 1: {score1}/100")
print(f"相似度 2: {score2}/100")
print(f"相似度 3: {score3}/100")
```

## 函數參數說明

### `evaluate_voice_similarity()`

```python
def evaluate_voice_similarity(
    audio_path1: str,              # 第一個音檔路徑
    audio_path2: str,              # 第二個音檔路徑
    model_source: str = "...",     # SpeechBrain 模型來源
    normalize_score: bool = True   # 是否標準化分數到 0-100
) -> dict
```

**返回值**:
```python
{
    'similarity_score': 85.67,     # 相似度分數
    'audio1': 'path/to/audio1.wav',
    'audio2': 'path/to/audio2.wav',
    'normalized': True,
    'status': 'success'            # 或 'error'
}
```

### `VoiceSimilarityEvaluator.calculate_similarity()`

```python
def calculate_similarity(
    audio_path1: str,              # 第一個音檔路徑
    audio_path2: str,              # 第二個音檔路徑
    normalize_score: bool = True   # 是否標準化分數
) -> float
```

**返回值**:
- 若 `normalize_score=True`: 返回 0-100 分 (100 表示完全相同)
- 若 `normalize_score=False`: 返回 -1 到 1 的餘弦相似度 (1 表示完全相同)

## 執行測試

```bash
cd worker
python tests/example_test_eval_embedding_voice_similarity.py
```

測試使用的音檔：
- `arctic_6mix_1.wav` - 位於 worker 目錄下
- `arctic_6mix_2.wav` - 位於 worker 目錄下

測試內容包括：
1. 基本相似度計算 (兩個不同音檔)
2. 同一音檔相似度測試 (應接近 100 分)
3. 兩個不同混音音檔的相似度
4. 使用評估器類別進行批量比較測試
5. 原始餘弦相似度測試 (未標準化分數)

## 在 app.py 中整合

```python
# worker/src/app.py
from flask import Flask, request, jsonify
import sys
from pathlib import Path

# 將 tests 目錄加入 Python path
tests_dir = Path(__file__).parent.parent / 'tests'
sys.path.insert(0, str(tests_dir))

from eval_embedding_voice_similarity import evaluate_voice_similarity

app = Flask(__name__)

@app.route('/worker/audio/similarity', methods=['POST'])
def calculate_audio_similarity():
    """計算兩個音檔的相似度"""
    try:
        # 接收上傳的音檔
        file1 = request.files.get('audio1')
        file2 = request.files.get('audio2')
        
        if not file1 or not file2:
            return jsonify({'error': '需要提供兩個音檔'}), 400
        
        # 儲存臨時檔案
        import os
        from werkzeug.utils import secure_filename
        
        temp_dir = Path(__file__).parent.parent / 'temp'
        temp_dir.mkdir(exist_ok=True)
        
        path1 = temp_dir / secure_filename(file1.filename)
        path2 = temp_dir / secure_filename(file2.filename)
        
        file1.save(str(path1))
        file2.save(str(path2))
        
        # 計算相似度
        result = evaluate_voice_similarity(str(path1), str(path2))
        
        # 清理臨時檔案
        os.remove(str(path1))
        os.remove(str(path2))
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## 環境變數設定 (選用)

如果需要使用 HuggingFace Token 來下載模型：

```bash
# worker/.env
HF_TOKEN_API_KEY=your_huggingface_token_here
```

模組會自動讀取此環境變數。

## 分數解讀

- **90-100 分**: 極高相似度，可能是同一說話者或同一音檔
- **70-89 分**: 高相似度，說話者聲音特徵相似
- **50-69 分**: 中等相似度，有一些共同特徵
- **30-49 分**: 低相似度，差異較大
- **0-29 分**: 極低相似度，明顯不同的說話者

## 技術細節

- **模型**: SpeechBrain ECAPA-TDNN (VoxCeleb 預訓練)
- **Embedding 維度**: 192 維
- **相似度計算**: 餘弦相似度 (Cosine Similarity)
- **支援格式**: WAV, FLAC, OGG 等 soundfile 支援的格式
- **Windows 兼容**: 使用 COPY 策略避免符號連結權限問題

## 注意事項

1. 首次執行時會自動下載預訓練模型 (~80MB)
2. 建議使用相同採樣率的音檔以獲得最佳效果
3. 音檔長度建議至少 1-2 秒以獲得穩定的 embedding
4. 背景噪音會影響相似度計算結果

## 已解決的問題

### ✅ Windows 符號連結權限問題
- **問題**: `OSError: [WinError 1314] 用戶端沒有這項特殊權限`
- **解決**: 使用 `LocalStrategy.COPY` 而非預設的 SYMLINK 策略

### ✅ HuggingFace Hub API 版本兼容
- **問題**: `use_auth_token` 參數在新版本中被改為 `token`
- **解決**: SpeechBrain 需要更新或手動修改

### ✅ TorchAudio 後端問題
- **問題**: `TorchCodec is required for load_with_torchcodec`
- **解決**: 改用 `soundfile` 直接讀取音訊，避免 torchcodec 依賴

## 效能優化建議

- 如需批量處理，使用 `VoiceSimilarityEvaluator` 類別以避免重複載入模型
- 可以預先計算並快取常用音檔的 embedding
- 考慮使用 GPU 加速 (自動偵測)

## 疑難排解

### 問題: 模型下載失敗
**解決方法**: 檢查網路連線，或設定 HF_TOKEN_API_KEY

### 問題: Windows 符號連結權限錯誤
**解決方法**: 已修復！代碼使用 `LocalStrategy.COPY` 避免此問題

### 問題: TorchCodec 錯誤
**解決方法**: 已修復！使用 `soundfile` 直接讀取音訊檔案

### 問題: 記憶體不足
**解決方法**: 減少批量處理的音檔數量，或使用較小的模型

### 問題: 音檔格式不支援
**解決方法**: 
- 確保安裝了 `soundfile`: `pip install soundfile`
- 支援格式: WAV, FLAC, OGG
- 不支援 MP3，需先轉換為 WAV
