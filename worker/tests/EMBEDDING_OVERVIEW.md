# Embedding 評估模組總覽

**最後更新**: 2025-11-06

## 📚 模組介紹

本專案提供兩種語音相似度評估模組，分別評估不同方面的相似度：

### 🎭 Speaker Embedding - 說話者相似度
**問題**: "這兩段語音是同一個人說的嗎？"

### 📝 Content Embedding - 語音內容相似度  
**問題**: "這兩段語音說了相同的內容嗎？"

---

## 🎯 核心差異對照表

| 特性 | 👤 Speaker Embedding | 💬 Content Embedding |
|------|---------------------|---------------------|
| **檔案** | `eval_embedding_voice_similarity.py` | `eval_content_embedding_similarity.py` |
| **關注點** | 誰在說話（聲音特徵） | 說了什麼（語義內容） |
| **技術** | 聲紋識別、說話者特徵 | 語音識別、語義理解 |
| **模型** | ECAPA-TDNN (SpeechBrain) | Wav2Vec2 (HuggingFace) |
| **模型大小** | ~83MB | ~360MB (base) |
| **同人不同話** | ✅ 高相似度 (85-95) | ❌ 低相似度 (30-50) |
| **異人同話** | ❌ 低相似度 (20-40) | ✅ 高相似度 (80-95) |
| **應用場景** | 身份驗證、聲紋識別 | 內容搜索、語音辨識 |
| **文檔** | `README_VOICE_SIMILARITY.md` | `README_CONTENT_SIMILARITY.md` |

---

## 📁 檔案結構

```
worker/tests/
│
├── 📘 EMBEDDING_OVERVIEW.md              # 本文件 - 總覽與選擇指南
│
├── 👤 Speaker Embedding (說話者相似度)
│   ├── eval_embedding_voice_similarity.py
│   ├── example_test_eval_embedding_voice_similarity.py  
│   └── README_VOICE_SIMILARITY.md
│
└── 💬 Content Embedding (內容相似度)
    ├── eval_content_embedding_similarity.py
    ├── example_test_eval_content_embedding_similarity.py
    └── README_CONTENT_SIMILARITY.md
```

---

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd worker

# 安裝基本依賴
pip install -r requirement.txt

# 安裝 SpeechBrain (用於 Speaker Embedding)
pip install git+https://github.com/speechbrain/speechbrain.git@develop
```

### 2. Speaker Embedding 快速測試

```bash
# 測試說話者相似度
python tests/example_test_eval_embedding_voice_similarity.py
```

```python
from tests.eval_embedding_voice_similarity import evaluate_voice_similarity

result = evaluate_voice_similarity('speaker_A_1.wav', 'speaker_A_2.wav')
print(f"說話者相似度: {result['similarity_score']}/100")
# 高分 → 可能是同一個人
```

### 3. Content Embedding 快速測試

```bash
# 測試內容相似度
python tests/example_test_eval_content_embedding_similarity.py
```

```python
from tests.eval_content_embedding_similarity import evaluate_content_similarity

result = evaluate_content_similarity('hello_A.wav', 'hello_B.wav')
print(f"內容相似度: {result['similarity_score']}/100")
# 高分 → 說了類似的內容
```

---

## 🧭 使用場景選擇指南

### ✅ 只需要 Speaker Embedding 的情況

**場景**: 身份驗證、聲紋識別、說話者追蹤

```python
from tests.eval_embedding_voice_similarity import evaluate_voice_similarity

# 例子：聲紋登入
register_voice = "user_register.wav"  
login_voice = "user_login.wav"

result = evaluate_voice_similarity(register_voice, login_voice)

if result['similarity_score'] > 80:
    print("✅ 身份驗證成功 - 是同一個人")
else:
    print("❌ 身份驗證失敗 - 不是同一個人")
```

### ✅ 只需要 Content Embedding 的情況

**場景**: 內容搜索、重複內容檢測、語音轉文字驗證

```python
from tests.eval_content_embedding_similarity import evaluate_content_similarity

# 例子：檢查用戶是否說了正確的內容
reference = "reference_script.wav"  # "Please say hello"
user_audio = "user_recording.wav"   # 用戶錄音

result = evaluate_content_similarity(reference, user_audio)

if result['similarity_score'] > 75:
    print("✅ 內容正確")
else:
    print("❌ 內容不符，請重新錄製")
```

### ✅ 同時需要兩者的情況

**場景**: 語音學習評分、會議分析、綜合驗證

```python
from tests.eval_embedding_voice_similarity import evaluate_voice_similarity
from tests.eval_content_embedding_similarity import evaluate_content_similarity

# 例子：語音學習系統
native_audio = "native_pronunciation.wav"
learner_audio = "learner_pronunciation.wav"

# 評估內容準確度
content_result = evaluate_content_similarity(native_audio, learner_audio)
print(f"✏️ 內容準確度: {content_result['similarity_score']}/100")

# 評估發音相似度
voice_result = evaluate_voice_similarity(native_audio, learner_audio)
print(f"🎵 發音相似度: {voice_result['similarity_score']}/100")

# 綜合評分 (內容佔 60%，發音佔 40%)
total_score = content_result['similarity_score'] * 0.6 + voice_result['similarity_score'] * 0.4
print(f"📊 總分: {total_score}/100")
```

---

## 🔬 實驗對照

### 實驗 1: 同一個人說不同的話

```python
audio1 = "speaker_A_hello.wav"      # A說: "Hello"
audio2 = "speaker_A_goodbye.wav"    # A說: "Goodbye"

speaker_score = evaluate_voice_similarity(audio1, audio2)
content_score = evaluate_content_similarity(audio1, audio2)

print(f"說話者相似度: {speaker_score['similarity_score']}/100")  # 預期: 85-95 (高)
print(f"內容相似度: {content_score['similarity_score']}/100")    # 預期: 30-50 (低)
```

**結論**: 同一個人 ✅ | 不同內容 ❌

---

### 實驗 2: 不同人說相同的話

```python
audio1 = "speaker_A_hello.wav"      # A說: "Hello"
audio2 = "speaker_B_hello.wav"      # B說: "Hello"

speaker_score = evaluate_voice_similarity(audio1, audio2)
content_score = evaluate_content_similarity(audio1, audio2)

print(f"說話者相似度: {speaker_score['similarity_score']}/100")  # 預期: 20-40 (低)
print(f"內容相似度: {content_score['similarity_score']}/100")    # 預期: 80-95 (高)
```

**結論**: 不同的人 ❌ | 相同內容 ✅

---

### 實驗 3: 同一個人說相同的話

```python
audio1 = "speaker_A_hello_1.wav"    # A說: "Hello" (第1次)
audio2 = "speaker_A_hello_2.wav"    # A說: "Hello" (第2次)

speaker_score = evaluate_voice_similarity(audio1, audio2)
content_score = evaluate_content_similarity(audio1, audio2)

print(f"說話者相似度: {speaker_score['similarity_score']}/100")  # 預期: 90-98 (極高)
print(f"內容相似度: {content_score['similarity_score']}/100")    # 預期: 90-98 (極高)
```

**結論**: 同一個人 ✅ | 相同內容 ✅

---

## 📊 完整應用範例

### 應用 1: 多重驗證系統

```python
def verify_user(reference_voice, test_voice, reference_content, test_content):
    """
    雙重驗證：同時驗證身份和內容
    """
    # 驗證身份
    speaker_result = evaluate_voice_similarity(reference_voice, test_voice)
    is_same_person = speaker_result['similarity_score'] > 80
    
    # 驗證內容
    content_result = evaluate_content_similarity(reference_content, test_content)
    is_correct_content = content_result['similarity_score'] > 75
    
    if is_same_person and is_correct_content:
        return "✅ 驗證成功：正確的人說了正確的內容"
    elif is_same_person and not is_correct_content:
        return "⚠️ 身份正確，但內容錯誤"
    elif not is_same_person and is_correct_content:
        return "❌ 內容正確，但不是本人"
    else:
        return "❌ 驗證失敗：身份和內容都不符"
```

### 應用 2: 會議記錄分析

```python
def analyze_meeting(audio_segments, speaker_profiles):
    """
    分析會議：誰說了什麼
    """
    from tests.eval_embedding_voice_similarity import VoiceSimilarityEvaluator
    from tests.eval_content_embedding_similarity import ContentSimilarityEvaluator
    
    speaker_eval = VoiceSimilarityEvaluator()
    content_eval = ContentSimilarityEvaluator()
    
    meeting_log = []
    
    for segment in audio_segments:
        # 1. 識別說話者
        speaker_id = None
        max_score = 0
        for name, profile in speaker_profiles.items():
            score = speaker_eval.calculate_similarity(segment, profile)
            if score > max_score and score > 70:
                max_score = score
                speaker_id = name
        
        # 2. 檢查內容重複
        is_duplicate = False
        for prev_segment in meeting_log:
            score = content_eval.calculate_similarity(segment, prev_segment['audio'])
            if score > 85:
                is_duplicate = True
                break
        
        meeting_log.append({
            'audio': segment,
            'speaker': speaker_id or "未知",
            'is_duplicate': is_duplicate
        })
    
    return meeting_log
```

### 應用 3: 語音學習評分系統

```python
def evaluate_pronunciation(reference_audio, learner_audio):
    """
    評估學習者的發音：內容 + 音調
    """
    # 內容準確度 (60%)
    content_result = evaluate_content_similarity(reference_audio, learner_audio)
    content_score = content_result['similarity_score']
    
    # 發音相似度 (40%)
    voice_result = evaluate_voice_similarity(reference_audio, learner_audio)
    voice_score = voice_result['similarity_score']
    
    # 計算總分
    total_score = content_score * 0.6 + voice_score * 0.4
    
    # 生成反饋
    feedback = []
    if content_score < 70:
        feedback.append("❌ 內容不準確，請檢查發音的每個詞")
    elif content_score < 85:
        feedback.append("⚠️ 內容大致正確，但還有改進空間")
    else:
        feedback.append("✅ 內容非常準確")
    
    if voice_score < 60:
        feedback.append("❌ 發音與標準差異較大，需要多加練習")
    elif voice_score < 75:
        feedback.append("⚠️ 發音可以接受，但還不夠自然")
    else:
        feedback.append("✅ 發音很接近母語者")
    
    return {
        'total_score': round(total_score, 2),
        'content_score': content_score,
        'voice_score': voice_score,
        'feedback': feedback
    }
```

---

## ⚡ 效能對比

| 指標 | Speaker Embedding | Content Embedding |
|------|-------------------|-------------------|
| **模型下載** | 83MB | 360MB (base) / 1.2GB (large) |
| **載入時間** | ~3-5秒 | ~5-10秒 |
| **處理速度 (CPU)** | ~0.5秒/音檔 ⚡⚡⚡ | ~1-2秒/音檔 ⚡⚡ |
| **記憶體使用** | ~500MB 💾 | ~1GB 💾💾 |
| **GPU 加速** | 支援 | 支援 |
| **即時處理** | ✅ 適合 | ⚠️ 可能有延遲 |

---

## 🎓 技術規格

### Speaker Embedding (ECAPA-TDNN)
- **模型**: SpeechBrain ECAPA-TDNN
- **訓練資料**: VoxCeleb (說話者識別)
- **Embedding 維度**: 192
- **採樣率**: 16kHz (推薦)
- **支援語言**: 所有語言（聲音特徵不受語言限制）

### Content Embedding (Wav2Vec2)
- **模型**: Facebook Wav2Vec2
- **訓練資料**: LibriSpeech (英文語音)
- **Embedding 維度**: 768 (base) / 1024 (large)
- **採樣率**: 16kHz (必須)
- **支援語言**: 英文（其他語言需要對應模型）

---

## 📖 詳細文檔

- **Speaker Embedding 詳細說明**: `README_VOICE_SIMILARITY.md`
- **Content Embedding 詳細說明**: `README_CONTENT_SIMILARITY.md`
- **Speaker Embedding 簡易指南**: `EMBEDDING_README.md`

---

## ❓ 常見問題

### Q: 我應該用哪個模組？

**A**: 取決於你的需求：
- 判斷「**是誰**」→ Speaker Embedding
- 判斷「**說什麼**」→ Content Embedding
- 需要兩者 → 同時使用

### Q: 兩個模組可以一起使用嗎？

**A**: ✅ 可以！很多應用需要同時使用，例如：
- 語音學習（內容 + 發音）
- 會議分析（誰 + 說了什麼）
- 多重驗證（身份 + 內容）

### Q: 哪個更準確？

**A**: 兩者針對不同目標，無法直接比較。在各自的領域都很準確。

### Q: 支援中文嗎？

**A**: 
- Speaker Embedding: ✅ 支援（聲音特徵不受語言限制）
- Content Embedding: ⚠️ 預設模型為英文，中文需要其他模型

### Q: 需要 GPU 嗎？

**A**: 不是必須，但 GPU 能顯著提升速度（5-10倍）。

---

## 🚦 快速決策流程圖

```
開始
  │
  ├─ 需要判斷是否為同一個人？
  │   └─ 是 → 使用 Speaker Embedding
  │
  ├─ 需要判斷內容是否相同？
  │   └─ 是 → 使用 Content Embedding
  │
  └─ 兩者都需要？
      └─ 是 → 同時使用兩個模組
```

---

**祝您使用順利！** 🎉

如有問題，請查閱對應的詳細文檔。
