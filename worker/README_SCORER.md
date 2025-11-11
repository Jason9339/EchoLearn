# AudioScorer - 統一音訊評分系統

## 檔案說明

1. **[AudioScorer_Guide.md](AudioScorer_Guide.md)** - 完整使用指南
   - 快速開始
   - 8 個評分指標說明
   - 常見用法範例
   - API 文件
   - 技術細節

2. **[example_audio_scorer.py](example_audio_scorer.py)** - 實際使用範例
   - 基本用法
   - 診斷弱點
   - 完整評估報告
   - 批次評分

3. **[src/services/audio_scorer.py](src/services/audio_scorer.py)** - 核心程式碼
   - AudioScorer 類別實作
   - 整合 PhoneCTC、SpeechMetrics、WER

## 30 秒快速開始

```python
from services.audio_scorer import AudioScorer

# 初始化
scorer = AudioScorer()

# 評分（輸入參考音檔和要評分的音檔）
scores = scorer.score("reference.wav", "test.wav")

# 查看結果（8 個指標，全部 0-1 之間，越高越好）
print(scores)
```

## 執行範例

```bash
cd /home/vipl/EchoLearn/worker
.venv/bin/python example_audio_scorer.py
```

## 8 個評分指標

| 指標 | 說明 | 評估內容 |
|------|------|---------|
| PER | 音素錯誤率相似度 | 發音準確度 |
| PPG | 音素後驗圖相似度 | 音素分佈 |
| GOP | 發音質量 | 整體發音 |
| GPE_offset | 音高相似度 | 音調變化 |
| FFE | F0 幀相似度 | 音高準確度 |
| WER | 詞錯誤率相似度 | 詞彙準確度 |
| Energy | 能量相似度 | 音量控制 |
| VDE | 濁音判斷相似度 | 濁音準確度 |

**所有指標都是 0-1 之間，越高越好！**

## 相關檔案

- 詳細文件：[AudioScorer_Guide.md](AudioScorer_Guide.md)
- 使用範例：[example_audio_scorer.py](example_audio_scorer.py)
- 核心程式碼：[src/services/audio_scorer.py](src/services/audio_scorer.py)
