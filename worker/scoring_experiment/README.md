# 評分系統實驗專案

使用機器學習模型預測語音模仿錄音的品質評分（1-5 星）

## 📊 專案概述

### 目標
基於 8 個客觀音訊指標，建立自動評分系統來預測錄音品質

### 資料集
- **1244 筆**有人工評分的錄音
- **8 個特徵**：PER, PPG, WER, GOP, GPE_offset, FFE, Energy, VDE
- **目標**：1-5 星評分（平均值：3.35，標準差：1.10）

### 最佳模型
- **Random Forest Regressor**
- **測試集 MAE**: 0.77 星
- **88%** 的預測誤差 < 1 星
- **特徵重要性**: PPG (0.22) > Energy (0.16) > PER (0.16)

---

## 📁 專案結構

```
scoring_experiment/
├── README.md                          # 專案說明（本檔案）
├── EXPERIMENT_LOG.md                  # 詳細實驗記錄
├── setup.sh                          # 環境設置腳本
├── requirements.txt                   # Python 套件依賴
├── requirements.lock                  # 鎖定的套件版本
├── .venv/                            # Python 虛擬環境
├── scripts/                          # 分析與訓練腳本
│   ├── analyze_scoring_simple.py      # 相關性分析
│   ├── train_baseline_model.py        # 訓練 3 種 baseline 模型
│   ├── scoring_service.py             # 評分服務（可直接使用）
│   ├── validate_baseline.py           # 模型驗證
│   ├── extract_new_features.py        # 提取進階音訊特徵（選用）
│   └── neural_network_assessment.md   # 神經網路可行性評估
├── data/                             # 處理後的資料集
├── models/                           # 訓練好的模型
│   ├── random_forest.joblib           # ⭐ 最佳模型
│   ├── linear_regression.joblib
│   ├── scaler.joblib
│   └── baseline_weights.json
└── results/                          # 實驗結果
    └── baseline_results.json
```

---

## 🚀 快速開始

### 1. 環境設置

```bash
cd worker/scoring_experiment
chmod +x setup.sh
./setup.sh
```

### 2. 使用評分服務

```python
from scripts.scoring_service import load_model, predict_score

# 載入模型（只需執行一次）
load_model()

# 準備指標資料
metrics = {
    'score_PER': 0.15,          # 音素錯誤率
    'score_PPG': 0.75,          # 音素後驗概率
    'score_WER': 0.18,          # 詞錯誤率
    'score_GOP': 0.65,          # 音素良度評估
    'score_GPE_offset': 0.70,   # 音素發音評估
    'score_FFE': 0.68,          # 頻譜流暢度
    'score_Energy': 0.80,       # 能量相似度
    'score_VDE': 0.62           # 聲音距離評估
}

# 預測評分
result = predict_score(metrics)

print(f"預測分數: {result['score']:.2f} 星")      # 例如: 3.24 星
print(f"整數星級: {result['score_int']} 星")      # 例如: 3 星
print(f"半星評分: {result['score_half']} 星")    # 例如: 3.0 星
print(f"信心等級: {result['confidence']}")       # high/medium/low
```

### 3. 執行實驗腳本

```bash
source .venv/bin/activate

# 相關性分析
python scripts/analyze_scoring_simple.py

# 訓練 baseline 模型
python scripts/train_baseline_model.py

# 驗證模型表現
python scripts/validate_baseline.py

# 測試評分服務
python scripts/scoring_service.py
```

---

## 📈 實驗結果

### Baseline 模型比較

| 模型 | 測試集 MAE | 測試集 R² | 整數星級準確度 |
|------|-----------|----------|--------------|
| 加權平均 | 1.12 | -0.50 | 26.91% |
| 線性回歸 | 0.85 | 0.16 | 32.53% |
| **隨機森林** ⭐ | **0.77** | **0.27** | **34.14%** |

### 驗證結果（100 筆樣本）
- **MAE**: 0.57 星
- **整數星級準確度**: 39%
- **52%** 的預測誤差 < 0.5 星
- **88%** 的預測誤差 < 1.0 星

詳細實驗記錄請參考 [EXPERIMENT_LOG.md](./EXPERIMENT_LOG.md)

---

## 🔧 開發指南

### 新增實驗
1. 在 `scripts/` 建立新的 Python 檔案
2. 執行實驗並記錄結果
3. 在 `EXPERIMENT_LOG.md` 中記錄發現

### 模型訓練
```bash
# 修改 train_baseline_model.py 中的超參數
# 重新訓練
python scripts/train_baseline_model.py

# 訓練好的模型會自動儲存到 models/
```

### 套件管理
```bash
# 安裝新套件
pip install package_name

# 更新 requirements
pip freeze > requirements.lock
```

---

## 📝 指標說明

### 8 個評分指標

| 指標 | 全名 | 方向 | 權重 | 說明 |
|------|------|------|------|------|
| PER | Phoneme Error Rate | ⬇️ 越低越好 | 0.31 | 音素錯誤率 |
| PPG | Phoneme Posteriorgram | ⬆️ 越高越好 | 0.31 | 音素後驗概率 |
| WER | Word Error Rate | ⬇️ 越低越好 | 0.29 | 詞錯誤率 |
| Energy | Energy Similarity | ⬆️ 越高越好 | 0.23 | 能量相似度 |
| VDE | Voice Distance Evaluation | ⬆️ 越高越好 | 0.16 | 聲音距離評估 |
| GPE | Goodness of Pronunciation Eval | ⬆️ 越高越好 | 0.15 | 音素發音評估 |
| GOP | Goodness of Pronunciation | ⬆️ 越高越好 | 0.08 | 音素良度評估 |
| FFE | Formant Fluency Evaluation | ⬆️ 越高越好 | 0.07 | 頻譜流暢度評估 |

---

## 🚧 未來改進方向

### 高優先級
1. ✅ **整合到 Flask API** - 建立 `/api/score` 端點
2. 🔄 **收集更多資料** - 增加訓練集規模

### 中優先級
3. 🚀 **提取新特徵** - 音高、語速、停頓（預期提升 15-25%）
4. 🚀 **嘗試 XGBoost** - 更強的梯度提升樹

### 低優先級
5. ⏸️ **神經網路** - 等資料量達到 5000+ 筆再考慮

詳細評估請參考 [neural_network_assessment.md](./scripts/neural_network_assessment.md)

---

## 📞 聯絡資訊

如有問題請參考：
- [EXPERIMENT_LOG.md](./EXPERIMENT_LOG.md) - 詳細實驗記錄
- [neural_network_assessment.md](./scripts/neural_network_assessment.md) - 模型選擇評估

---

## 📄 授權

此專案為 EchoLearn 的一部分
