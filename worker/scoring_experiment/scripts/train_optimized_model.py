"""
訓練優化後的最終模型

基於改進實驗結果：
- 只使用 ≥3 位評分者的資料
- Random Forest with optimized hyperparameters
"""

import json
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os

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


def load_data(dataset_path, min_raters=3):
    """載入並準備訓練資料"""
    print("="*80)
    print(f"載入資料集 (最少評分人數: {min_raters})...")
    print("="*80)

    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # 只保留有足夠評分的資料
    rated_data = [d for d in data if d.get('rating_count', 0) >= min_raters]

    print(f"總樣本數: {len(data)}")
    print(f"≥{min_raters} 位評分者: {len(rated_data)}")

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


def print_metrics(y_true, y_pred, title=""):
    """印出評估指標"""
    if title:
        print(f"\n{title}:")

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    # 星級準確度
    y_true_rounded = np.round(y_true * 2) / 2
    y_pred_rounded = np.round(y_pred * 2) / 2
    star_accuracy = np.mean(y_true_rounded == y_pred_rounded)

    y_true_int = np.round(y_true)
    y_pred_int = np.round(y_pred)
    exact_accuracy = np.mean(y_true_int == y_pred_int)

    # 誤差分佈
    errors = np.abs(y_pred - y_true)
    within_half = np.mean(errors <= 0.5)
    within_1 = np.mean(errors <= 1.0)
    within_1_5 = np.mean(errors <= 1.5)

    print(f"  MAE (平均絕對誤差):     {mae:.4f} 星")
    print(f"  RMSE (均方根誤差):       {rmse:.4f} 星")
    print(f"  R² (決定係數):           {r2:.4f}")
    print(f"  0.5 星準確度:            {star_accuracy*100:.2f}%")
    print(f"  整數星級準確度:          {exact_accuracy*100:.2f}%")
    print(f"\n  誤差分佈:")
    print(f"    ≤ 0.5 星: {within_half*100:.2f}%")
    print(f"    ≤ 1.0 星: {within_1*100:.2f}%")
    print(f"    ≤ 1.5 星: {within_1_5*100:.2f}%")

    return {
        'mae': mae,
        'rmse': rmse,
        'r2': r2,
        'exact_accuracy': exact_accuracy,
        'within_1_star': within_1,
        'within_half_star': within_half
    }


def main():
    # 路徑設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    print("\n" + "="*80)
    print("訓練優化後的評分模型")
    print("="*80)
    print("\n策略：")
    print("  1. 只使用 ≥3 位評分者的高品質資料")
    print("  2. Random Forest with optimized hyperparameters")
    print("  3. min_samples_split=5, min_samples_leaf=2 (更靈活)")
    print()

    # 載入資料
    X, y, raw_data = load_data(dataset_path, min_raters=3)

    # 分割訓練/測試集 (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"\n訓練集大小: {len(X_train)}")
    print(f"測試集大小: {len(X_test)}")

    # 訓練優化模型
    print("\n" + "="*80)
    print("訓練 Random Forest (優化版)")
    print("="*80)

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,   # 優化：從 10 改為 5
        min_samples_leaf=2,    # 優化：從 5 改為 2
        random_state=42,
        n_jobs=-1
    )

    print("\n訓練中...")
    model.fit(X_train, y_train)

    # 預測
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # 限制在 1-5 範圍
    y_pred_train = np.clip(y_pred_train, 1, 5)
    y_pred_test = np.clip(y_pred_test, 1, 5)

    # 評估
    print("\n" + "="*80)
    print("模型表現")
    print("="*80)

    train_metrics = print_metrics(y_train, y_pred_train, "訓練集")
    test_metrics = print_metrics(y_test, y_pred_test, "測試集")

    # 特徵重要性
    print("\n" + "="*80)
    print("特徵重要性排名")
    print("="*80)

    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]

    for i in indices:
        print(f"  {SCORE_COLUMNS[i]:20s}: {importances[i]:.4f}")

    # 與 baseline 比較
    print("\n" + "="*80)
    print("與 Baseline 比較")
    print("="*80)

    baseline_mae = 0.7743  # 從之前的訓練結果
    optimized_mae = test_metrics['mae']
    improvement = (baseline_mae - optimized_mae) / baseline_mae * 100

    print(f"\nBaseline (全部資料):     MAE = {baseline_mae:.4f} 星")
    print(f"優化版 (≥3 評分者):     MAE = {optimized_mae:.4f} 星")
    print(f"改進幅度:                {improvement:+.2f}%")

    if improvement > 0:
        print(f"\n✅ 優化成功！誤差減少 {improvement:.2f}%")
    else:
        print(f"\n⚠️  優化效果有限")

    # 交叉驗證
    print("\n" + "="*80)
    print("交叉驗證 (5-fold)")
    print("="*80)

    cv_scores = cross_val_score(model, X, y, cv=5,
                                scoring='neg_mean_absolute_error',
                                n_jobs=-1)
    cv_mae = -cv_scores.mean()
    cv_std = cv_scores.std()

    print(f"\n  平均 MAE: {cv_mae:.4f} ± {cv_std:.4f} 星")
    print(f"  各 fold MAE: {[-s for s in cv_scores]}")

    # 儲存模型
    print("\n" + "="*80)
    print("儲存模型")
    print("="*80)

    model_path = os.path.join(models_dir, 'random_forest_optimized.joblib')
    joblib.dump(model, model_path)
    print(f"\n✅ 模型已儲存: {model_path}")

    # 儲存配置
    config = {
        'model_type': 'random_forest',
        'version': 'optimized_v1',
        'min_raters': 3,
        'hyperparameters': {
            'n_estimators': 100,
            'max_depth': 10,
            'min_samples_split': 5,
            'min_samples_leaf': 2
        },
        'training_samples': len(X),
        'test_metrics': {
            'mae': float(test_metrics['mae']),
            'rmse': float(test_metrics['rmse']),
            'r2': float(test_metrics['r2']),
            'exact_accuracy': float(test_metrics['exact_accuracy']),
            'within_1_star': float(test_metrics['within_1_star'])
        },
        'cross_validation': {
            'cv_mae_mean': float(cv_mae),
            'cv_mae_std': float(cv_std)
        },
        'improvement_over_baseline': float(improvement),
        'metric_info': METRIC_INFO,
        'feature_columns': SCORE_COLUMNS
    }

    config_path = os.path.join(models_dir, 'optimized_model_config.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f"✅ 配置已儲存: {config_path}")

    # 最終建議
    print("\n" + "="*80)
    print("部署建議")
    print("="*80)

    print(f"\n模型表現總結：")
    print(f"  • MAE: {test_metrics['mae']:.4f} 星")
    print(f"  • ±1 星準確度: {test_metrics['within_1_star']*100:.1f}%")
    print(f"  • 整數星級準確度: {test_metrics['exact_accuracy']*100:.1f}%")

    if test_metrics['mae'] < 0.70:
        print(f"\n✅ 強烈建議部署")
        print(f"   MAE < 0.70，準確度優秀")
    elif test_metrics['mae'] < 0.75:
        print(f"\n✅ 建議部署")
        print(f"   MAE < 0.75，準確度良好")
    else:
        print(f"\n⚠️  建議審慎評估")
        print(f"   MAE 仍偏高，可能需要進一步改進")

    print(f"\n⚠️  注意事項：")
    print(f"   • 此模型基於 {len(X)} 筆高品質資料（≥3 位評分者）")
    print(f"   • 對於評分人數少的樣本，預測可能較不準確")
    print(f"   • 建議持續收集資料，定期重新訓練")

    return config


if __name__ == '__main__':
    results = main()
    print("\n✅ 訓練完成！")
