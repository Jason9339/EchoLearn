"""
改進實驗：測試各種優化方案的效果

優先級排序：
1. 只用 ≥3 位評分者資料（資料品質）
2. XGBoost 模型（模型優化）
3. 超參數調校（Fine-tuning）
"""

import json
import os
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

# 嘗試導入 XGBoost
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️  XGBoost 未安裝，將跳過 XGBoost 實驗")

METRIC_INFO = {
    'score_PER': {'reverse': True},
    'score_PPG': {'reverse': False},
    'score_WER': {'reverse': True},
    'score_GOP': {'reverse': False},
    'score_GPE_offset': {'reverse': False},
    'score_FFE': {'reverse': False},
    'score_Energy': {'reverse': False},
    'score_VDE': {'reverse': False}
}

SCORE_COLUMNS = list(METRIC_INFO.keys())


def load_data(dataset_path, min_raters=1):
    """
    載入資料，可指定最少評分人數
    """
    print(f"載入資料集 (最少評分人數: {min_raters})...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # 篩選條件
    rated_data = [d for d in data
                  if d.get('rating_count', 0) >= min_raters]

    print(f"總樣本數: {len(data)}")
    print(f"符合條件樣本: {len(rated_data)}")

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
            if METRIC_INFO[col]['reverse']:
                score = 1 - score
            features.append(score)

        if valid and 'rating_avg' in item:
            X.append(features)
            y.append(item['rating_avg'])

    X = np.array(X)
    y = np.array(y)

    print(f"有效訓練樣本: {len(X)}")
    return X, y


def evaluate_model(y_true, y_pred, model_name):
    """
    評估模型表現
    """
    y_pred_clipped = np.clip(y_pred, 1, 5)

    mae = mean_absolute_error(y_true, y_pred_clipped)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred_clipped))
    r2 = r2_score(y_true, y_pred_clipped)

    # 星級準確度
    pred_int = np.round(y_pred_clipped)
    true_int = np.round(y_true)
    exact_acc = np.mean(pred_int == true_int)

    # 誤差分佈
    errors = np.abs(y_pred_clipped - y_true)
    within_1 = np.mean(errors <= 1.0)

    print(f"\n{model_name}:")
    print(f"  MAE:  {mae:.4f} 星")
    print(f"  RMSE: {rmse:.4f} 星")
    print(f"  R²:   {r2:.4f}")
    print(f"  整數星級準確度: {exact_acc*100:.2f}%")
    print(f"  ±1星準確度:     {within_1*100:.2f}%")

    return {
        'mae': mae,
        'rmse': rmse,
        'r2': r2,
        'exact_accuracy': exact_acc,
        'within_1_star': within_1
    }


def experiment_1_data_quality(dataset_path):
    """
    實驗 1: 資料品質影響
    比較不同最少評分人數的效果
    """
    print("\n" + "="*80)
    print("實驗 1: 資料品質影響 - 只使用高信心評分資料")
    print("="*80)

    results = {}

    for min_raters in [1, 2, 3]:
        print(f"\n{'='*80}")
        print(f"最少評分人數: {min_raters}")
        print(f"{'='*80}")

        X, y = load_data(dataset_path, min_raters=min_raters)

        if len(X) < 100:
            print(f"⚠️  樣本數太少 ({len(X)})，跳過")
            continue

        # 訓練測試分割
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # 訓練 Random Forest
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_train, y_train)

        # 評估
        y_pred_test = model.predict(X_test)
        metrics = evaluate_model(y_test, y_pred_test, f"RF (≥{min_raters} 評分者)")

        results[f'min_raters_{min_raters}'] = {
            'sample_count': len(X),
            'metrics': metrics
        }

    return results


def experiment_2_xgboost(dataset_path):
    """
    實驗 2: XGBoost vs Random Forest
    """
    print("\n" + "="*80)
    print("實驗 2: XGBoost 模型對比")
    print("="*80)

    if not XGBOOST_AVAILABLE:
        print("⚠️  XGBoost 未安裝，跳過此實驗")
        return None

    X, y = load_data(dataset_path, min_raters=1)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    results = {}

    # Random Forest (baseline)
    print("\n訓練 Random Forest (baseline)...")
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)
    results['random_forest'] = evaluate_model(y_test, y_pred_rf, "Random Forest")

    # XGBoost
    print("\n訓練 XGBoost...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train)
    y_pred_xgb = xgb_model.predict(X_test)
    results['xgboost'] = evaluate_model(y_test, y_pred_xgb, "XGBoost")

    # 比較
    print("\n" + "="*80)
    print("模型比較")
    print("="*80)
    mae_improvement = (results['random_forest']['mae'] - results['xgboost']['mae']) / results['random_forest']['mae'] * 100

    if results['xgboost']['mae'] < results['random_forest']['mae']:
        print(f"✅ XGBoost 優於 RF，MAE 改進 {mae_improvement:.2f}%")
        print(f"   RF MAE:  {results['random_forest']['mae']:.4f}")
        print(f"   XGB MAE: {results['xgboost']['mae']:.4f}")
        winner = 'xgboost'
    else:
        print(f"⚠️  RF 仍優於 XGBoost")
        winner = 'random_forest'

    results['winner'] = winner
    return results


def experiment_3_hyperparameter_tuning(dataset_path):
    """
    實驗 3: Random Forest 超參數調校
    """
    print("\n" + "="*80)
    print("實驗 3: Random Forest 超參數調校")
    print("="*80)

    X, y = load_data(dataset_path, min_raters=1)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    results = {}

    # Baseline (當前參數)
    print("\n訓練 Baseline...")
    baseline = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    baseline.fit(X_train, y_train)
    y_pred = baseline.predict(X_test)
    results['baseline'] = evaluate_model(y_test, y_pred, "Baseline RF")

    # 調整 1: 增加樹數量
    print("\n訓練 更多樹 (200 棵)...")
    more_trees = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    more_trees.fit(X_train, y_train)
    y_pred = more_trees.predict(X_test)
    results['more_trees'] = evaluate_model(y_test, y_pred, "RF (200 棵樹)")

    # 調整 2: 增加深度
    print("\n訓練 更深的樹 (depth=15)...")
    deeper = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    deeper.fit(X_train, y_train)
    y_pred = deeper.predict(X_test)
    results['deeper'] = evaluate_model(y_test, y_pred, "RF (深度 15)")

    # 調整 3: 減少最小樣本數
    print("\n訓練 更靈活的樹 (min_samples=5)...")
    flexible = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    flexible.fit(X_train, y_train)
    y_pred = flexible.predict(X_test)
    results['flexible'] = evaluate_model(y_test, y_pred, "RF (更靈活)")

    # 找出最佳配置
    best_config = min(results.items(), key=lambda x: x[1]['mae'])
    print("\n" + "="*80)
    print(f"最佳配置: {best_config[0]} (MAE: {best_config[1]['mae']:.4f})")
    print("="*80)

    results['best'] = best_config[0]
    return results


def main():
    """
    執行所有改進實驗
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')

    all_results = {}

    # 實驗 1: 資料品質
    exp1_results = experiment_1_data_quality(dataset_path)
    all_results['experiment_1_data_quality'] = exp1_results

    # 實驗 2: XGBoost
    exp2_results = experiment_2_xgboost(dataset_path)
    if exp2_results:
        all_results['experiment_2_xgboost'] = exp2_results

    # 實驗 3: 超參數調校
    exp3_results = experiment_3_hyperparameter_tuning(dataset_path)
    all_results['experiment_3_hyperparameters'] = exp3_results

    # 總結
    print("\n" + "="*80)
    print("📊 改進實驗總結")
    print("="*80)

    # 實驗 1 總結
    print("\n1️⃣  資料品質影響:")
    if 'experiment_1_data_quality' in all_results:
        for key, result in all_results['experiment_1_data_quality'].items():
            min_raters = key.split('_')[-1]
            print(f"   ≥{min_raters} 評分者: MAE = {result['metrics']['mae']:.4f} ({result['sample_count']} 樣本)")

    # 實驗 2 總結
    print("\n2️⃣  XGBoost vs Random Forest:")
    if 'experiment_2_xgboost' in all_results:
        exp2 = all_results['experiment_2_xgboost']
        print(f"   Random Forest: MAE = {exp2['random_forest']['mae']:.4f}")
        print(f"   XGBoost:       MAE = {exp2['xgboost']['mae']:.4f}")
        print(f"   勝者: {exp2['winner']}")
    else:
        print("   ⚠️  XGBoost 未安裝，無法比較")

    # 實驗 3 總結
    print("\n3️⃣  超參數調校:")
    if 'experiment_3_hyperparameters' in all_results:
        exp3 = all_results['experiment_3_hyperparameters']
        baseline_mae = exp3['baseline']['mae']
        best_config = exp3['best']
        best_mae = exp3[best_config]['mae']
        improvement = (baseline_mae - best_mae) / baseline_mae * 100

        print(f"   Baseline:  MAE = {baseline_mae:.4f}")
        print(f"   最佳配置:  {best_config}, MAE = {best_mae:.4f}")
        if improvement > 0:
            print(f"   ✅ 改進 {improvement:.2f}%")
        else:
            print(f"   ⚠️  無明顯改進")

    # 最終建議
    print("\n" + "="*80)
    print("💡 最終建議")
    print("="*80)

    recommendations = []

    # 檢查資料品質影響
    if 'experiment_1_data_quality' in all_results:
        if 'min_raters_3' in all_results['experiment_1_data_quality']:
            mae_all = all_results['experiment_1_data_quality']['min_raters_1']['metrics']['mae']
            mae_3plus = all_results['experiment_1_data_quality']['min_raters_3']['metrics']['mae']

            if mae_3plus < mae_all * 0.95:  # 改進 5% 以上
                recommendations.append({
                    'priority': 'high',
                    'action': '只使用 ≥3 位評分者的資料',
                    'reason': f'MAE 從 {mae_all:.4f} 降至 {mae_3plus:.4f}',
                    'tradeoff': f'樣本數減少至 {all_results["experiment_1_data_quality"]["min_raters_3"]["sample_count"]} 筆'
                })

    # 檢查 XGBoost
    if 'experiment_2_xgboost' in all_results:
        if all_results['experiment_2_xgboost']['winner'] == 'xgboost':
            improvement = (all_results['experiment_2_xgboost']['random_forest']['mae'] -
                          all_results['experiment_2_xgboost']['xgboost']['mae'])
            recommendations.append({
                'priority': 'medium',
                'action': '改用 XGBoost 模型',
                'reason': f'MAE 改進 {improvement:.4f} 星',
                'tradeoff': '需要額外安裝 xgboost 套件'
            })

    # 檢查超參數
    if 'experiment_3_hyperparameters' in all_results:
        exp3 = all_results['experiment_3_hyperparameters']
        if exp3['best'] != 'baseline':
            improvement = exp3['baseline']['mae'] - exp3[exp3['best']]['mae']
            if improvement > 0.01:  # 改進超過 0.01 星
                recommendations.append({
                    'priority': 'low',
                    'action': f'調整 RF 超參數為 {exp3["best"]}',
                    'reason': f'MAE 改進 {improvement:.4f} 星',
                    'tradeoff': '輕微增加訓練時間'
                })

    if recommendations:
        print("\n推薦改進措施（依優先級排序）：")
        for i, rec in enumerate(sorted(recommendations,
                                       key=lambda x: {'high': 1, 'medium': 2, 'low': 3}[x['priority']]), 1):
            priority_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}[rec['priority']]
            print(f"\n{i}. {priority_icon} {rec['action']}")
            print(f"   理由: {rec['reason']}")
            print(f"   代價: {rec['tradeoff']}")
    else:
        print("\n✅ 當前配置已經相當優秀，無明顯改進空間")

    # 儲存結果
    output_path = os.path.join(base_dir, 'results/improvement_experiments.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        # Convert numpy types to Python types for JSON serialization
        def convert(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            return obj

        json.dump(all_results, f, indent=2, ensure_ascii=False, default=convert)

    print(f"\n✅ 實驗結果已儲存至: {output_path}")


if __name__ == '__main__':
    main()
