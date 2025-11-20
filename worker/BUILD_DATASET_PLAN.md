# EchoLearn 訓練集建立計劃

## 目標

從 Supabase 蒐集所有錄音資料，計算 AudioScorer 的 8 個評分指標，並整合人工評分（ratings），建立一個標準化的訓練集供機器學習使用。

---

## 資料來源分析

### 1. Supabase Tables

#### `recordings` 表
```sql
- id: UUID (primary key)
- user_id: UUID (錄音者)
- course_id: VARCHAR(255) (課程 ID，如 "shadowing-101")
- sentence_id: INTEGER (句子 ID)
- slot_index: INTEGER (錄音槽位)
- audio_url: TEXT (Supabase Storage URL)
- duration: NUMERIC (秒)
- file_size: INTEGER (bytes)
- created_at: TIMESTAMP
```

#### `ratings` 表
```sql
- id: SERIAL (primary key)
- recording_id: UUID (關聯到 recordings.id)
- rater_user_id: UUID (評分者)
- sentence_id: INTEGER
- slot_index: INTEGER
- score: INTEGER (1-5 分)
- created_at: TIMESTAMP
```

### 2. Supabase Storage

- **Bucket**: `recordings`
- **子目錄**: `audio/`、`audio-women/`（實際儲存採用連字號；腳本仍兼容底線拼法以防歷史資料）
- **路徑格式**: 從 `audio_url` 欄位提取
- **對應規則**：
  - `audio_url` 以 `recordings/audio/...` 開頭 → 男聲樣本
  - `audio_url` 以 `recordings/audio-women/...`（或舊資料的 `recordings/audio_women/...`）開頭 → 女聲樣本
- **格式**: WebM (需要轉換為 WAV 供 AudioScorer 使用)

### 3. 參考音檔

根據 course_id 有兩種參考音檔：

- **男聲 (audio)**: `/home/vipl/EchoLearn/public/audio/cmu_us_bdl_arctic/`
- **女聲 (audio-women)**: `/home/vipl/EchoLearn/public/audio/cmu_us_clb_arctic/`
- **格式**: WAV
- **命名**: `arctic_a{sentence_id}.wav`

**對應關係**：
- 如果 course_id 包含 "audio-women"（或歷史拼字 "audio_women"）→ 使用 `cmu_us_clb_arctic`（女聲）
- 其他情況 → 使用 `cmu_us_bdl_arctic`（男聲）

---

## 資料集結構設計

```
/home/vipl/EchoLearn/dataset/
├── README.md                    # 資料集說明文件
├── metadata.json                # 資料集整體統計
├── dataset.csv                  # 主要訓練集表格
├── dataset.json                 # JSON 格式（備用）
├── statistics_report.txt        # 統計報告
├── audio/
│   ├── reference/              # 參考音檔（依課程分層的軟連結或複製）
│   │   ├── audio/
│   │   │   ├── arctic_a0001.wav
│   │   │   └── ...
│   │   └── audio-women/
│   │       ├── arctic_a0001.wav
│   │       └── ...
│   └── recordings/             # 用戶錄音（從 Supabase 下載）
│       ├── {recording_id_1}.wav
│       ├── {recording_id_2}.wav
│       └── ...
└── scripts/
    ├── 01_download_data.py     # 下載資料
    ├── 02_compute_scores.py    # 計算 AudioScorer 分數
    ├── 03_generate_dataset.py  # 生成最終資料集
    └── config.py               # 配置檔案
```

---

## 訓練集 Schema

### dataset.csv / dataset.json

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `recording_id` | UUID | 錄音唯一 ID | `a1b2c3d4-...` |
| `user_id` | UUID | 錄音者 ID | `u1u2u3u4-...` |
| `course_id` | STRING | 課程 ID | `shadowing-101` |
| `sentence_id` | INTEGER | 句子 ID | `1` |
| `slot_index` | INTEGER | 錄音槽位 | `0` |
| `reference_audio_id` | STRING | 參考音檔 ID（例如 `arctic_a0001`） | `arctic_a0001` |
| `reference_audio` | STRING | 參考音檔路徑 | `audio/reference/arctic_a0001.wav` |
| `recording_audio` | STRING | 錄音檔案路徑 | `audio/recordings/{uuid}.wav` |
| **AudioScorer 指標** | | | |
| `score_PER` | FLOAT | 音素錯誤率相似度 (0-1) | `0.8523` |
| `score_PPG` | FLOAT | 音素後驗圖相似度 (0-1) | `0.9012` |
| `score_GOP` | FLOAT | 發音質量 (0-1) | `0.8756` |
| `score_GPE_offset` | FLOAT | 音高相似度 (0-1) | `0.9123` |
| `score_FFE` | FLOAT | F0 幀相似度 (0-1) | `0.8890` |
| `score_WER` | FLOAT | 詞錯誤率相似度 (0-1) | `0.8500` |
| `score_Energy` | FLOAT | 能量相似度 (0-1) | `0.8700` |
| `score_VDE` | FLOAT | 濁音判斷相似度 (0-1) | `0.9300` |
| **人工評分** | | | |
| `rating_count` | INTEGER | 評分人數 | `3` |
| `rating_avg` | FLOAT | 平均評分 (1-5) | `4.33` |

> Dataset 不需要 `score_avg`、`rating_std`、`rating_min`、`rating_max`、`ratings_list`、`file_size`、`created_at` 等欄位，保持欄位最小化方便訓練。

---

## 實作步驟

### Step 1: 環境準備

```bash
# 創建 dataset 目錄
mkdir -p /home/vipl/EchoLearn/dataset/{audio/{reference,recordings},scripts}

# 安裝 Python 依賴
cd /home/vipl/EchoLearn/worker
.venv/bin/pip install supabase pandas python-dotenv
```

### Step 2: 配置 Supabase 連線

創建 `scripts/config.py`：
```python
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # 需要 service role key
DATASET_ROOT = "/home/vipl/EchoLearn/dataset"
REFERENCE_AUDIO_DIR_MALE = "/home/vipl/EchoLearn/public/audio/cmu_us_bdl_arctic"
REFERENCE_AUDIO_DIR_FEMALE = "/home/vipl/EchoLearn/public/audio/cmu_us_clb_arctic"
```

### Step 3: 下載資料 (01_download_data.py)

**功能：**
1. 從 `recordings` 表查詢所有錄音記錄
2. 從 `ratings` 表查詢所有評分記錄
3. 解析 `audio_url`（實際路徑為 `audio-women`，仍兼容 `audio_women`）並在需要時嘗試多個候選路徑下載
4. 針對 Storage 回應（HTTP 200/502 等）檢查是否真為 bytes，確保錯誤 JSON 不會進入 ffmpeg
5. 將 WebM 轉換為 WAV 格式
6. 建立 `audio/reference/{audio,audio-women}/` 的軟連結或複製（依 course_id 分層）

**輸出：**
- `dataset/audio/recordings/{uuid}.wav` - 所有用戶錄音
- `dataset/audio/reference/` - 參考音檔
- `dataset/raw_data.json` - 原始資料（recordings + ratings）

### Step 4: 計算 AudioScorer 分數 (02_compute_scores.py)

**功能：**
1. 讀取 `raw_data.json`
2. 對每個錄音：
   - 找到對應的參考音檔（根據 sentence_id）
   - 使用 `worker/src/services/audio_scorer.py` 中的 `AudioScorer.score()` 計算 8 個指標
   - 保存結果到中間檔案
3. 支援斷點續傳（避免重複計算）
4. 顯示進度條和預估時間

**輸出：**
- `dataset/scores.json` - 所有錄音的 AudioScorer 分數
- `dataset/compute_log.txt` - 計算日誌

### Step 5: 整合並生成最終資料集 (03_generate_dataset.py)

**功能：**
1. 讀取 `raw_data.json` 和 `scores.json`
2. 按 `recording_id` 合併資料
3. 對每個錄音：
   - 對 ratings 依 `recording_id` 聚合出 `rating_count` 與 `rating_avg`
   - 整合 AudioScorer 的 8 個分數
4. 生成統計報告：
   - 總錄音數
   - 每個 sentence_id 的錄音數分佈
   - 有/無人工評分的錄音數
   - AudioScorer 各指標的統計（mean, std, min, max）
5. 輸出 CSV 和 JSON 格式

**輸出：**
- `dataset/dataset.csv` - 主要訓練集
- `dataset/dataset.json` - JSON 格式
- `dataset/metadata.json` - 資料集統計
- `dataset/statistics_report.txt` - 詳細統計報告

### Step 6: 建立 README (手動或自動生成)

**內容：**
- 資料集描述
- Schema 說明
- 使用方法
- 統計資訊
- 授權和引用資訊

---

## 執行流程

```bash
cd /home/vipl/EchoLearn/dataset/scripts

# Step 1: 下載所有資料
.venv/bin/python 01_download_data.py

# Step 2: 計算 AudioScorer 分數（耗時較長）
.venv/bin/python 02_compute_scores.py

# Step 3: 生成最終資料集
.venv/bin/python 03_generate_dataset.py

# 檢查結果
head -20 ../dataset.csv
cat ../statistics_report.txt
```

---

## 預期挑戰與解決方案

### 挑戰 1: 音檔格式轉換
- **問題**: Supabase 存的是 WebM，AudioScorer 需要 WAV
- **解決**: 使用 `ffmpeg` 或 `pydub` 轉換

### 挑戰 2: 計算時間過長
- **問題**: AudioScorer 計算較慢，大量錄音需要很長時間
- **解決**:
  - 實作進度保存和斷點續傳
  - 使用 GPU 加速（PhoneCTC 和 Whisper）
  - 顯示進度條和預估剩餘時間

### 挑戰 3: 找不到參考音檔
- **問題**: 某些 sentence_id 可能沒有對應的參考音檔
- **解決**:
  - 先掃描所有可用的參考音檔
  - 跳過沒有參考音檔的錄音
  - 記錄在日誌中

### 挑戰 4: 記憶體不足
- **問題**: 大量資料一次載入可能導致 OOM
- **解決**:
  - 使用批次處理
  - 及時釋放不需要的模型和資料

### 挑戰 5: ratings 資料稀疏
- **問題**: 不是所有錄音都有人工評分
- **解決**:
  - 保留 `rating_count = 0` 的錄音
  - 在統計報告中分別統計有/無評分的資料

---

## 資料集用途

1. **訓練 AutoScorer 模型**：使用 AudioScorer 的 8 個指標作為 ground truth
2. **訓練 Rating Predictor**：預測人工評分 (1-5)
3. **研究 AudioScorer 與人工評分的相關性**：分析哪些指標與人工評分最相關
4. **發音錯誤偵測**：找出常見的發音問題
5. **個性化回饋系統**：根據指標給出具體改進建議

---

## 時間預估

| 步驟 | 預估時間 | 說明 |
|------|---------|------|
| 環境準備 | 10 分鐘 | 安裝依賴 |
| 下載資料 | 30-60 分鐘 | 取決於錄音數量和網路速度 |
| 計算 AudioScorer | **2-8 小時** | 主要瓶頸，取決於錄音數量和硬體 |
| 生成資料集 | 5-10 分鐘 | 資料整合和統計 |
| 撰寫文件 | 20-30 分鐘 | README 和說明 |
| **總計** | **3-10 小時** | 主要取決於資料量 |

**優化建議**：
- 使用 GPU 可將 AudioScorer 計算時間減少 50-70%
- 可以分批次執行，不需要一次完成

---

## 成功指標

✅ 所有錄音都成功下載並轉換為 WAV
✅ AudioScorer 成功計算所有 8 個指標
✅ ratings 資料正確合併（包含平均值和統計）
✅ CSV 和 JSON 格式正確，可以被 pandas/numpy 讀取
✅ 統計報告完整，包含資料分佈和相關性分析
✅ README 清晰，其他人可以理解如何使用資料集

---

## 下一步

確認此計劃後，我將：
1. 創建 `config.py` 配置檔案
2. 實作 `01_download_data.py` 下載腳本
3. 實作 `02_compute_scores.py` 評分腳本
4. 實作 `03_generate_dataset.py` 生成腳本
5. 生成 README 和統計報告

請確認以上計劃是否符合需求，或是否需要調整？
