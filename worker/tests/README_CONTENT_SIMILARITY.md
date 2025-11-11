# 語音內容相似度評估模組 (Content Embedding)

## 簡介

此模組使用 Wav2Vec2 預訓練模型來計算兩個音檔之間的**語音內容相似度**。與 Speaker Embedding 不同，Content Embedding 專注於「**說了什麼**」而非「**誰在說話**」。

### Content Embedding vs Speaker Embedding

| 特性 | Content Embedding | Speaker Embedding |
|------|-------------------|-------------------|
| **關注點** | 語音內容（語義、音素） | 說話者聲音特徵 |
| **相同內容不同人** | ✅ 高相似度 | ❌ 低相似度 |
| **相同人不同內容** | ❌ 低相似度 | ✅ 高相似度 |
| **應用場景** | 語音辨識、內容搜索 | 說話者識別、聲紋認證 |
| **模型** | Wav2Vec2, HuBERT | ECAPA-TDNN |

## 檔案說明

- **`eval_content_embedding_similarity.py`**: 核心功能模組
  - `ContentSimilarityEvaluator`: 內容相似度評估器類別
  - `evaluate_content_similarity()`: 便利函數，快速計算相似度

- **`example_test_eval_content_embedding_similarity.py`**: 測試範例
  - 展示如何在 app.py 中引用此模組
  - 包含多種測試案例和概念說明

## 安裝依賴

```bash
cd worker
pip install transformers soundfile torch
```

主要依賴套件：
- `transformers` (HuggingFace，用於 Wav2Vec2 模型)
- `torch`
- `soundfile` (用於音訊載入)

## 使用方式

### 方法 1: 使用便利函數 (推薦)

```python
from tests.eval_content_embedding_similarity import evaluate_content_similarity

# 計算兩個音檔的內容相似度
result = evaluate_content_similarity('audio1.wav', 'audio2.wav')

print(result['similarity_score'])  # 輸出: 0-100 分
print(result['type'])              # 輸出: 'content'
print(result['status'])            # 輸出: 'success' 或 'error'
```

### 方法 2: 使用評估器類別 (批量處理)

```python
from tests.eval_content_embedding_similarity import ContentSimilarityEvaluator

# 建立評估器 (模型只載入一次)
evaluator = ContentSimilarityEvaluator()

# 計算多個音檔的內容相似度
score1 = evaluator.calculate_similarity('audio1.wav', 'audio2.wav')
score2 = evaluator.calculate_similarity('audio1.wav', 'audio3.wav')
score3 = evaluator.calculate_similarity('audio1.wav', 'audio4.wav')

print(f"內容相似度 1: {score1}/100")
print(f"內容相似度 2: {score2}/100")
print(f"內容相似度 3: {score3}/100")
```

### 方法 3: 同時使用 Content 和 Speaker Embedding

```python
from tests.eval_content_embedding_similarity import evaluate_content_similarity
from tests.eval_embedding_voice_similarity import evaluate_voice_similarity

# 計算內容相似度（說了什麼）
content_result = evaluate_content_similarity('user_audio.wav', 'reference.wav')
print(f"內容相似度: {content_result['similarity_score']}/100")

# 計算說話者相似度（誰在說話）
speaker_result = evaluate_voice_similarity('user_audio.wav', 'reference.wav')
print(f"說話者相似度: {speaker_result['similarity_score']}/100")

# 綜合判斷
if content_result['similarity_score'] > 80 and speaker_result['similarity_score'] > 80:
    print("✅ 同一人說了相同的內容")
elif content_result['similarity_score'] > 80:
    print("✅ 內容相同，但可能是不同人說的")
elif speaker_result['similarity_score'] > 80:
    print("✅ 同一個人，但說了不同的內容")
else:
    print("❌ 不同人說了不同內容")
```

## 函數參數說明

### `evaluate_content_similarity()`

```python
def evaluate_content_similarity(
    audio_path1: str,                           # 第一個音檔路徑
    audio_path2: str,                           # 第二個音檔路徑
    model_name: str = "facebook/wav2vec2-base-960h",  # 模型名稱
    normalize_score: bool = True                # 是否標準化分數到 0-100
) -> dict
```

**返回值**:
```python
{
    'similarity_score': 85.67,     # 內容相似度分數
    'audio1': 'path/to/audio1.wav',
    'audio2': 'path/to/audio2.wav',
    'normalized': True,
    'type': 'content',             # 標記為內容相似度
    'status': 'success'            # 或 'error'
}
```

### 可用的模型

| 模型名稱 | 大小 | 準確度 | 速度 | 推薦用途 |
|---------|------|--------|------|---------|
| `facebook/wav2vec2-base-960h` | ~360MB | 中等 | 快 | ✅ 一般使用 |
| `facebook/wav2vec2-large-960h` | ~1.2GB | 高 | 慢 | 高準確度需求 |
| `facebook/wav2vec2-large-960h-lv60-self` | ~1.2GB | 最高 | 慢 | 研究/高精度 |

## 執行測試

```bash
cd worker
python tests/example_test_eval_content_embedding_similarity.py
```

測試使用的音檔：
- `arctic_6mix_1.wav` - 位於 worker 目錄下
- `arctic_6mix_2.wav` - 位於 worker 目錄下

測試內容包括：
1. 基本內容相似度計算
2. 同一音檔內容相似度測試 (應接近 100 分)
3. Content vs Speaker Embedding 概念說明
4. 使用評估器類別進行批量比較
5. 原始餘弦相似度測試

## 在 app.py 中整合

```python
# worker/src/app.py
from flask import Flask, request, jsonify
import sys
from pathlib import Path

# 將 tests 目錄加入 Python path
tests_dir = Path(__file__).parent.parent / 'tests'
sys.path.insert(0, str(tests_dir))

from eval_content_embedding_similarity import evaluate_content_similarity

app = Flask(__name__)

@app.route('/worker/audio/content-similarity', methods=['POST'])
def calculate_content_similarity():
    """計算兩個音檔的內容相似度"""
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
        
        # 計算內容相似度
        result = evaluate_content_similarity(str(path1), str(path2))
        
        # 清理臨時檔案
        os.remove(str(path1))
        os.remove(str(path2))
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## 分數解讀

### Content Similarity (內容相似度)

- **90-100 分**: 幾乎相同的內容（可能是相同文字）
- **70-89 分**: 內容高度相似（類似的詞彙或句子）
- **50-69 分**: 內容部分相似（某些共同詞彙）
- **30-49 分**: 內容差異較大
- **0-29 分**: 完全不同的內容

### 實際應用範例

```python
# 範例：語音學習評分
user_audio = "user_pronunciation.wav"
reference_audio = "native_speaker.wav"

content_score = evaluate_content_similarity(user_audio, reference_audio)
speaker_score = evaluate_voice_similarity(user_audio, reference_audio)

print(f"內容準確度: {content_score['similarity_score']}/100")
print(f"發音相似度: {speaker_score['similarity_score']}/100")

# 評分邏輯
if content_score['similarity_score'] > 85:
    print("✅ 內容正確！")
else:
    print("❌ 請檢查內容是否正確")
```

## 技術細節

- **模型**: Facebook Wav2Vec2 (預訓練於 LibriSpeech)
- **Embedding 來源**: 最後一層隱藏狀態的平均池化
- **相似度計算**: 餘弦相似度 (Cosine Similarity)
- **輸入要求**: 16kHz 單聲道音訊（自動處理）
- **支援格式**: WAV, FLAC, OGG 等 soundfile 支援的格式

## 注意事項

1. **首次執行**會自動下載預訓練模型 (~360MB for base model)
2. **採樣率**: 模型需要 16kHz，其他採樣率會有警告
3. **音檔長度**: 建議 1-30 秒，太短可能不穩定，太長會消耗更多記憶體
4. **語言**: 預設模型訓練於英文，其他語言可能需要不同模型
5. **GPU 加速**: 如果有 GPU 會自動使用，顯著提升速度

## 效能優化建議

1. **批量處理**: 使用 `ContentSimilarityEvaluator` 類別避免重複載入模型
2. **GPU 使用**: 在有 GPU 的環境下執行可提升 5-10 倍速度
3. **模型選擇**: 
   - 快速應用：使用 `wav2vec2-base`
   - 高準確度：使用 `wav2vec2-large`
4. **預計算 Embedding**: 對於固定的參考音檔，可以預先計算並儲存 embedding

## 疑難排解

### 問題: 模型下載失敗
**解決方法**: 
- 檢查網路連線
- 設定 HF_TOKEN_API_KEY 環境變數
- 使用鏡像站：`export HF_ENDPOINT=https://hf-mirror.com`

### 問題: CUDA out of memory
**解決方法**: 
- 使用較小的模型 (base 而非 large)
- 處理較短的音檔
- 減少批次大小

### 問題: 採樣率警告
**解決方法**: 
- 使用 `librosa` 或 `scipy` 進行高品質重採樣
- 或提前將音檔轉換為 16kHz

### 問題: 音檔格式不支援
**解決方法**: 
- 安裝 `soundfile`: `pip install soundfile`
- 支援格式: WAV, FLAC, OGG
- MP3 需要安裝額外套件或轉換為 WAV

## 與 Speaker Embedding 的比較

```python
# 實驗：同一個人說不同內容
audio1 = "speaker_A_hello.wav"
audio2 = "speaker_A_goodbye.wav"

content = evaluate_content_similarity(audio1, audio2)
speaker = evaluate_voice_similarity(audio1, audio2)

# 預期結果：
# content_score: 低（不同內容）
# speaker_score: 高（同一個人）
```

```python
# 實驗：不同人說相同內容
audio1 = "speaker_A_hello.wav"
audio2 = "speaker_B_hello.wav"

content = evaluate_content_similarity(audio1, audio2)
speaker = evaluate_voice_similarity(audio1, audio2)

# 預期結果：
# content_score: 高（相同內容）
# speaker_score: 低（不同人）
```

## 進階應用

### 1. 語音內容去重
```python
# 檢測重複內容
def is_duplicate_content(new_audio, existing_audios, threshold=80):
    for existing in existing_audios:
        result = evaluate_content_similarity(new_audio, existing)
        if result['similarity_score'] > threshold:
            return True
    return False
```

### 2. 語音內容搜尋
```python
# 在語音庫中搜尋相似內容
def search_similar_content(query_audio, audio_library, top_k=5):
    evaluator = ContentSimilarityEvaluator()
    scores = []
    for audio in audio_library:
        score = evaluator.calculate_similarity(query_audio, audio)
        scores.append((audio, score))
    return sorted(scores, key=lambda x: x[1], reverse=True)[:top_k]
```

### 3. 語音品質控制
```python
# 檢查錄音是否符合腳本
def verify_recording(audio_path, reference_script_audio, min_score=70):
    result = evaluate_content_similarity(audio_path, reference_script_audio)
    if result['similarity_score'] >= min_score:
        return True, "錄音內容符合腳本"
    else:
        return False, f"內容不符，相似度僅 {result['similarity_score']}/100"
```

## 參考資源

- [Wav2Vec2 論文](https://arxiv.org/abs/2006.11477)
- [HuggingFace Wav2Vec2 文檔](https://huggingface.co/docs/transformers/model_doc/wav2vec2)
- [SpeechBrain 官方文檔](https://speechbrain.github.io/)
