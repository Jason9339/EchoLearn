# 音素相似度計算功能

基於深度學習的語音發音相似度評估，提供三種音素級別的相似度計算方法。

---

## 快速安裝

```bash
# 1. 安裝 PyTorch (選擇 GPU 或 CPU 版本)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121  # GPU
# 或
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu   # CPU

# 2. 安裝其他依賴
pip install -r requirements.txt

# 3. 安裝系統工具 (可選但建議)
sudo apt-get install ffmpeg

# 4. 驗證安裝
python3 test_installation.py
```

---

## 功能模組

```
worker/src/services/
├── preprocessing.py      # 音訊前處理
├── phoneme_ctc.py       # 音素 CTC 辨識 (共用)
├── phoneme_per.py       # PER 相似度 (最快)
├── phoneme_gop.py       # GOP 相似度 (平衡)
└── phoneme_ppg.py       # PPG 相似度 (最準確)
```

---

## 基本使用

### 1. 計算相似度

```python
from src.services.phoneme_per import calculate_per_similarity
from src.services.phoneme_gop import calculate_gop_similarity
from src.services.phoneme_ppg import calculate_ppg_similarity

# 任選一種
per_score = calculate_per_similarity("audio1.wav", "audio2.wav")
gop_score = calculate_gop_similarity("audio1.wav", "audio2.wav")
ppg_score = calculate_ppg_similarity("audio1.wav", "audio2.wav")

print(f"相似度: {per_score:.4f}")  # 返回 0.0~1.0
```

### 2. 使用前處理 (建議)

```python
from src.services.preprocessing import preprocess_pipeline

# 前處理提升音質
clean1 = preprocess_pipeline("raw1.wav", "clean1.wav")
clean2 = preprocess_pipeline("raw2.wav", "clean2.wav")

# 再計算相似度
score = calculate_per_similarity(clean1, clean2)
```

### 3. 批次處理 (重用模型)

```python
from src.services.phoneme_ctc import PhoneCTC
from src.services.phoneme_per import calculate_per_similarity

# 初始化一次
ctc = PhoneCTC()

# 重複使用
for audio_file in audio_files:
    score = calculate_per_similarity(audio_file, "reference.wav", ctc=ctc)
    print(f"{audio_file}: {score:.4f}")
```

---

## 三種方法比較

| 方法 | 速度 | 準確度 | 適用場景 |
|------|------|--------|----------|
| **PER** | 最快 ⚡⚡⚡ | 中等 ⭐⭐ | 大量批次處理、快速篩選 |
| **GOP** | 中等 ⚡⚡ | 較高 ⭐⭐⭐ | 發音品質評估、細節比較 |
| **PPG** | 較慢 ⚡ | 最高 ⭐⭐⭐⭐ | 精確評估、研究用途 |

---

## API 參考

### 前處理

```python
preprocess_pipeline(
    src_path: str,              # 輸入音檔
    out_path: str,              # 輸出音檔
    target_sr: int = 16000,     # 採樣率
    target_lufs: float = -16.0, # 響度標準化
    use_deepfilter: bool = False # 是否降噪
) -> Path
```

### PER 相似度 (最快)

```python
calculate_per_similarity(
    audio_a_path: str,          # 音檔 A
    audio_b_path: str,          # 音檔 B
    ctc: PhoneCTC = None        # 可選: 重用模型
) -> float  # 返回 0.0~1.0
```

### GOP 相似度 (平衡)

```python
calculate_gop_similarity(
    audio_a_path: str,          # 音檔 A
    audio_b_path: str,          # 音檔 B
    ctc: PhoneCTC = None,       # 可選: 重用模型
    tau: float = 1.0,           # 溫度參數
    lambda_duration: float = 0.01 # 持續時間權重
) -> float  # 返回 0.0~1.0
```

### PPG 相似度 (最準確)

```python
calculate_ppg_similarity(
    audio_a_path: str,          # 音檔 A
    audio_b_path: str,          # 音檔 B
    ctc: PhoneCTC = None,       # 可選: 重用模型
    metric: str = "jsd",        # 度量方式: "jsd" 或 "cosine"
    band: int = 100,            # DTW 對齊範圍 (None=全局)
    downsample: int = 3         # 下採樣因子 (加速計算)
) -> float  # 返回 0.0~1.0
```

---

## 常見問題

### Q: 如何加速計算？
- 使用 GPU (自動偵測)
- 重用 `PhoneCTC` 實例
- PPG: 增加 `downsample`、減少 `band`、使用 `metric="cosine"`
- 選擇 PER 而非 PPG

### Q: 如何提升準確度？
- 使用 `preprocess_pipeline()` 前處理
- 選擇 PPG 方法
- PPG: 設定 `band=None`, `downsample=1`, `metric="jsd"`

### Q: GPU 記憶體不足？
```python
import torch
device = torch.device("cpu")
ctc = PhoneCTC(device=device)
```

### Q: 模型下載失敗？
```bash
# 設定鏡像 (中國地區)
export HF_ENDPOINT=https://hf-mirror.com
```

---

## 系統需求

- Python 3.10+
- 磁碟空間: 5GB+ (包含模型)
- 記憶體: 2GB+ (CPU) 或 4GB+ (GPU)
- (推薦) NVIDIA GPU + CUDA

---

## 完整範例

```python
from pathlib import Path
from src.services.preprocessing import preprocess_pipeline
from src.services.phoneme_ctc import PhoneCTC
from src.services.phoneme_per import calculate_per_similarity

# 1. 前處理
reference_clean = preprocess_pipeline("teacher.wav", "teacher_clean.wav")

# 2. 初始化模型
ctc = PhoneCTC()

# 3. 批次評估學生發音
students = Path("students").glob("*.wav")

for student_file in students:
    # 前處理
    student_clean = preprocess_pipeline(student_file, f"clean/{student_file.name}")

    # 計算相似度
    score = calculate_per_similarity(student_clean, reference_clean, ctc=ctc)

    # 評分
    if score > 0.8:
        grade = "優秀"
    elif score > 0.6:
        grade = "良好"
    elif score > 0.4:
        grade = "及格"
    else:
        grade = "需加強"

    print(f"{student_file.stem}: {grade} ({score:.2%})")
```

---

**安裝問題?** 執行 `python3 test_installation.py` 檢查

**需要詳細說明?** 查看各 `.py` 檔案內的 docstring
