"""
訓練 Baseline 評分模型

使用現有的 8 個指標訓練簡單的評分模型：
1. Weighted Average (加權平均)
2. Linear Regression (線性回歸)
3. Random Forest (隨機森林)

輸出: 1-5 星的評分
"""

import json
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib
import os

# 指標定義
METRIC_INFO = {
    'score_PER': {'reverse': True, 'weight': 0.31},
    'score_PPG': {'reverse': False, 'weight': 0.31},
    'score_WER': {'reverse': True, 'weight': 0.29},
    'score_GOP': {'reverse': False, 'weight': 0.08},
    'score_GPE_offset': {'reverse': False, 'weight': 0.15},
    'score_FFE': {'reverse': False, 'weight': 0.07},
    'score_Energy': {'reverse': False, 'weight': 0.23},
    'score_VDE': {'reverse': False, 'weight': 0.16}
}

SCORE_COLUMNS = list(METRIC_INFO.keys())


def load_data(dataset_path):
    """載入並準備訓練資料"""
    print("載入資料集...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # 只保留有評分的資料
    rated_data = [d for d in data if d.get('rating_count', 0) > 0]

    print(f"總樣本數: {len(data)}")
    print(f"有評分樣本: {len(rated_data)}")

    # 提取特徵和標籤
    X = []
    y = []

    for item in rated_data:
        features = []
        valid = True

        for col in SCORE_COLUMNS:
            if col not in item or item[col] is None:
                valid = False
                break

            score = item[col]
            # 如果是 error rate，反轉
            if METRIC_INFO[col]['reverse']:
                score = 1 - score
            features.append(score)

        if valid and 'rating_avg' in item:
            X.append(features)
            y.append(item['rating_avg'])

    X = np.array(X)
    y = np.array(y)

    print(f"有效訓練樣本: {len(X)}")
    print(f"特徵維度: {X.shape}")

    return X, y, rated_data


def weighted_average_baseline(X, weights):
    """
    方法 1: 加權平均 Baseline

    使用相關係數作為權重
    """
    # 正規化權重
    weights = np.array(weights)
    weights = weights / np.sum(weights)

    # 加權平均
    scores = np.dot(X, weights)

    # 縮放到 1-5 範圍
    # 假設加權後的分數在 0-1 之間
    scores = scores * 4 + 1  # 映射到 1-5
    scores = np.clip(scores, 1, 5)

    return scores


def train_linear_regression(X_train, y_train, X_test, y_test):
    """
    方法 2: 線性回歸
    """
    print("\n" + "="*60)
    print("訓練線性回歸模型")
    print("="*60)

    # 標準化特徵
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 訓練模型
    model = Ridge(alpha=1.0)  # 使用 Ridge 避免過擬合
    model.fit(X_train_scaled, y_train)

    # 預測
    y_pred_train = model.predict(X_train_scaled)
    y_pred_test = model.predict(X_test_scaled)

    # 限制在 1-5 範圍
    y_pred_train = np.clip(y_pred_train, 1, 5)
    y_pred_test = np.clip(y_pred_test, 1, 5)

    # 評估
    print("\n訓練集:")
    print_metrics(y_train, y_pred_train)

    print("\n測試集:")
    print_metrics(y_test, y_pred_test)

    # 特徵重要性
    print("\n特徵係數 (重要性):")
    for i, col in enumerate(SCORE_COLUMNS):
        coef = model.coef_[i]
        print(f"  {col:20s}: {coef:7.4f}")

    return model, scaler


def train_random_forest(X_train, y_train, X_test, y_test):
    """
    方法 3: 隨機森林
    """
    print("\n" + "="*60)
    print("訓練隨機森林模型")
    print("="*60)

    # 訓練模型
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # 預測
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # 限制在 1-5 範圍
    y_pred_train = np.clip(y_pred_train, 1, 5)
    y_pred_test = np.clip(y_pred_test, 1, 5)

    # 評估
    print("\n訓練集:")
    print_metrics(y_train, y_pred_train)

    print("\n測試集:")
    print_metrics(y_test, y_pred_test)

    # 特徵重要性
    print("\n特徵重要性:")
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]

    for i in indices:
        print(f"  {SCORE_COLUMNS[i]:20s}: {importances[i]:.4f}")

    return model


def print_metrics(y_true, y_pred):
    """印出評估指標"""
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    # 星級準確度（四捨五入到最近的 0.5 星）
    y_true_rounded = np.round(y_true * 2) / 2
    y_pred_rounded = np.round(y_pred * 2) / 2
    star_accuracy = np.mean(y_true_rounded == y_pred_rounded)

    # 完全準確度（整數星級）
    y_true_int = np.round(y_true)
    y_pred_int = np.round(y_pred)
    exact_accuracy = np.mean(y_true_int == y_pred_int)

    print(f"  MAE (平均絕對誤差):     {mae:.4f} 星")
    print(f"  RMSE (均方根誤差):       {rmse:.4f} 星")
    print(f"  R² (決定係數):           {r2:.4f}")
    print(f"  0.5 星準確度:            {star_accuracy*100:.2f}%")
    print(f"  整數星級準確度:          {exact_accuracy*100:.2f}%")


def main():
    # 路徑設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # 載入資料
    X, y, raw_data = load_data(dataset_path)

    # 分割訓練/測試集 (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"\n訓練集大小: {len(X_train)}")
    print(f"測試集大小: {len(X_test)}")

    # ========================================
    # 方法 1: 加權平均 Baseline
    # ========================================
    print("\n" + "="*60)
    print("方法 1: 加權平均 Baseline")
    print("="*60)

    weights = [METRIC_INFO[col]['weight'] for col in SCORE_COLUMNS]

    y_pred_train_wa = weighted_average_baseline(X_train, weights)
    y_pred_test_wa = weighted_average_baseline(X_test, weights)

    print("\n訓練集:")
    print_metrics(y_train, y_pred_train_wa)

    print("\n測試集:")
    print_metrics(y_test, y_pred_test_wa)

    # 儲存權重
    baseline_config = {
        'method': 'weighted_average',
        'weights': {col: METRIC_INFO[col]['weight'] for col in SCORE_COLUMNS},
        'metric_info': METRIC_INFO
    }

    with open(os.path.join(models_dir, 'baseline_weights.json'), 'w') as f:
        json.dump(baseline_config, f, indent=2)

    # ========================================
    # 方法 2: 線性回歸
    # ========================================
    lr_model, scaler = train_linear_regression(X_train, y_train, X_test, y_test)

    # 儲存模型
    joblib.dump(lr_model, os.path.join(models_dir, 'linear_regression.joblib'))
    joblib.dump(scaler, os.path.join(models_dir, 'scaler.joblib'))

    # ========================================
    # 方法 3: 隨機森林
    # ========================================
    rf_model = train_random_forest(X_train, y_train, X_test, y_test)

    # 儲存模型
    joblib.dump(rf_model, os.path.join(models_dir, 'random_forest.joblib'))

    # ========================================
    # 總結比較
    # ========================================
    print("\n" + "="*60)
    print("模型比較總結")
    print("="*60)

    models_comparison = {
        '加權平均': {
            'train_mae': mean_absolute_error(y_train, y_pred_train_wa),
            'test_mae': mean_absolute_error(y_test, y_pred_test_wa),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test_wa)),
            'test_r2': r2_score(y_test, y_pred_test_wa)
        },
        '線性回歸': {
            'train_mae': mean_absolute_error(y_train, np.clip(lr_model.predict(scaler.transform(X_train)), 1, 5)),
            'test_mae': mean_absolute_error(y_test, np.clip(lr_model.predict(scaler.transform(X_test)), 1, 5)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, np.clip(lr_model.predict(scaler.transform(X_test)), 1, 5))),
            'test_r2': r2_score(y_test, np.clip(lr_model.predict(scaler.transform(X_test)), 1, 5))
        },
        '隨機森林': {
            'train_mae': mean_absolute_error(y_train, np.clip(rf_model.predict(X_train), 1, 5)),
            'test_mae': mean_absolute_error(y_test, np.clip(rf_model.predict(X_test), 1, 5)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, np.clip(rf_model.predict(X_test), 1, 5))),
            'test_r2': r2_score(y_test, np.clip(rf_model.predict(X_test), 1, 5))
        }
    }

    print("\n測試集表現:")
    print(f"{'模型':<12} {'MAE':<8} {'RMSE':<8} {'R²':<8}")
    print("-" * 40)
    for name, metrics in models_comparison.items():
        print(f"{name:<12} {metrics['test_mae']:<8.4f} {metrics['test_rmse']:<8.4f} {metrics['test_r2']:<8.4f}")

    # 選擇最佳模型
    best_model_name = min(models_comparison.keys(),
                         key=lambda x: models_comparison[x]['test_mae'])

    print(f"\n✅ 最佳模型: {best_model_name}")
    print(f"   測試集 MAE: {models_comparison[best_model_name]['test_mae']:.4f} 星")

    # 儲存結果
    results = {
        'models_comparison': models_comparison,
        'best_model': best_model_name,
        'metric_columns': SCORE_COLUMNS,
        'metric_info': METRIC_INFO
    }

    with open(os.path.join(base_dir, 'results/baseline_results.json'), 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n✅ 模型已儲存至: {models_dir}/")
    print(f"✅ 結果已儲存至: {base_dir}/results/baseline_results.json")


if __name__ == '__main__':
    main()
