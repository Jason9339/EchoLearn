"""
實驗一：容忍區間準確率評估

目標：找出最佳的容忍區間 n%，讓準確率更有解釋性

評估方式：
- 對每個特徵設定容忍區間
- 預測值與真實值的差異在 ±n% 範圍內算「正確」
- 測試不同 n 值 (0-100%) 找出最佳平衡點

注意：排除 WER 以支援多語言
"""

import json
import os
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
import matplotlib.pyplot as plt

# 排除 WER，支援多語言
METRIC_INFO = {
    'score_PER': {'reverse': True, 'name': 'Phoneme Error Rate'},
    'score_PPG': {'reverse': False, 'name': 'Phoneme Posteriorgram'},
    # 'score_WER': {'reverse': True},  # 排除 - 限定英文
    'score_GOP': {'reverse': False, 'name': 'Goodness of Pronunciation'},
    'score_GPE_offset': {'reverse': False, 'name': 'Pronunciation Evaluation'},
    'score_FFE': {'reverse': False, 'name': 'Formant Fluency'},
    'score_Energy': {'reverse': False, 'name': 'Energy Similarity'},
    'score_VDE': {'reverse': False, 'name': 'Voice Distance'}
}

SCORE_COLUMNS = list(METRIC_INFO.keys())


def load_data(dataset_path, min_raters=1):
    """載入資料（排除 WER）"""
    print(f"載入資料集...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    rated_data = [d for d in data if d.get('rating_count', 0) >= min_raters]

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

    return np.array(X), np.array(y)


def tolerance_accuracy(y_true, y_pred, tolerance_percent):
    """
    計算容忍區間準確率

    容忍區間定義：
    - 對於 1-5 星評分，總範圍是 4 星
    - tolerance_percent% 的容忍範圍 = 4 * (tolerance_percent / 100)

    例如：20% 容忍範圍 = 4 * 0.2 = 0.8 星
    """
    range_size = 4.0  # 1-5 星的範圍
    tolerance = range_size * (tolerance_percent / 100)

    errors = np.abs(y_pred - y_true)
    accurate = errors <= tolerance

    return np.mean(accurate) * 100


def star_based_accuracy(y_true, y_pred, tolerance_stars):
    """
    以星級為單位的容忍準確率

    例如：tolerance_stars=0.5 表示誤差在 ±0.5 星內算正確
    """
    errors = np.abs(y_pred - y_true)
    accurate = errors <= tolerance_stars
    return np.mean(accurate) * 100


def integer_star_accuracy(y_true, y_pred):
    """
    整數星級準確率（四捨五入後完全相同）
    """
    y_true_int = np.round(y_true).astype(int)
    y_pred_int = np.round(y_pred).astype(int)
    return np.mean(y_true_int == y_pred_int) * 100


def adjacent_star_accuracy(y_true, y_pred):
    """
    相鄰星級準確率（允許 ±1 星誤差）

    這是一個很好的指標：
    - 如果真實是 4 星，預測 3/4/5 星都算正確
    - 對用戶來說，±1 星的誤差是可接受的
    """
    y_true_int = np.round(y_true).astype(int)
    y_pred_int = np.round(y_pred).astype(int)
    diff = np.abs(y_true_int - y_pred_int)
    return np.mean(diff <= 1) * 100


def run_experiment(dataset_path):
    """
    執行容忍區間實驗
    """
    print("="*80)
    print("實驗一：容忍區間準確率評估")
    print("="*80)
    print("\n目標：找出最佳的評估指標，讓結果更有解釋性")
    print("注意：已排除 WER 指標以支援多語言")
    print(f"使用特徵：{SCORE_COLUMNS}")

    # 載入資料
    X, y = load_data(dataset_path)
    print(f"\n樣本數: {len(X)}")
    print(f"特徵數: {len(SCORE_COLUMNS)} (排除 WER)")

    # 分割資料
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # 訓練模型
    print("\n訓練 Random Forest...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # 預測
    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 1, 5)

    # 基礎指標
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = np.mean(np.abs(y_test - y_pred))

    print("\n" + "="*80)
    print("基礎指標")
    print("="*80)
    print(f"RMSE: {rmse:.4f} 星")
    print(f"MAE:  {mae:.4f} 星")

    # ============================================================
    # 實驗 1: 不同容忍百分比
    # ============================================================
    print("\n" + "="*80)
    print("實驗 1: 容忍百分比 (n%) 分析")
    print("="*80)
    print("\n容忍範圍 = 4 星 × n%")
    print("例如：20% = ±0.8 星")

    tolerance_percents = [5, 10, 15, 20, 25, 30, 40, 50]
    results_percent = []

    print(f"\n{'容忍%':<10} {'容忍範圍':<12} {'準確率':<10}")
    print("-" * 35)

    for pct in tolerance_percents:
        tolerance_range = 4.0 * (pct / 100)
        acc = tolerance_accuracy(y_test, y_pred, pct)
        results_percent.append({'percent': pct, 'range': tolerance_range, 'accuracy': acc})
        print(f"{pct}%        ±{tolerance_range:.2f} 星      {acc:.2f}%")

    # ============================================================
    # 實驗 2: 以星級為單位的容忍
    # ============================================================
    print("\n" + "="*80)
    print("實驗 2: 星級容忍分析")
    print("="*80)

    star_tolerances = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
    results_star = []

    print(f"\n{'容忍星級':<12} {'準確率':<10} {'解釋':<30}")
    print("-" * 55)

    for tol in star_tolerances:
        acc = star_based_accuracy(y_test, y_pred, tol)
        results_star.append({'tolerance': tol, 'accuracy': acc})

        if tol == 0.5:
            desc = "半星精準"
        elif tol == 1.0:
            desc = "±1 星可接受誤差"
        elif tol == 0.25:
            desc = "極高精準度"
        else:
            desc = ""

        print(f"±{tol} 星       {acc:.2f}%     {desc}")

    # ============================================================
    # 實驗 3: 整數星級準確率
    # ============================================================
    print("\n" + "="*80)
    print("實驗 3: 整數星級準確率（報告用）")
    print("="*80)

    exact_acc = integer_star_accuracy(y_test, y_pred)
    adjacent_acc = adjacent_star_accuracy(y_test, y_pred)

    print(f"\n1. 精確匹配準確率 (Exact Match):     {exact_acc:.2f}%")
    print(f"   → 預測星級與真實星級完全相同")

    print(f"\n2. 相鄰星級準確率 (Adjacent Match):  {adjacent_acc:.2f}%")
    print(f"   → 預測星級與真實星級相差 ≤1 星")
    print(f"   → 這是最適合報告的指標！")

    # ============================================================
    # 建議的報告指標
    # ============================================================
    print("\n" + "="*80)
    print("📊 建議的報告指標")
    print("="*80)

    print(f"""
推薦使用以下指標來報告：

┌─────────────────────────────────────────────────────────────┐
│  指標名稱                    數值          解釋              │
├─────────────────────────────────────────────────────────────┤
│  相鄰星級準確率 (±1 星)      {adjacent_acc:.1f}%        ← 主要指標    │
│  精確匹配準確率              {exact_acc:.1f}%                        │
│  半星準確率 (±0.5 星)        {star_based_accuracy(y_test, y_pred, 0.5):.1f}%                        │
│  RMSE                        {rmse:.2f} 星                        │
└─────────────────────────────────────────────────────────────┘

報告範例：
  "我們的評分系統達到 {adjacent_acc:.1f}% 的相鄰星級準確率，
   表示預測結果與人工評分的誤差在 ±1 星以內。"
    """)

    # ============================================================
    # 特徵重要性
    # ============================================================
    print("\n" + "="*80)
    print("特徵重要性（排除 WER）")
    print("="*80)

    importances = model.feature_importances_
    for col, imp in sorted(zip(SCORE_COLUMNS, importances), key=lambda x: x[1], reverse=True):
        print(f"  {col:20s}: {imp:.4f}")

    # ============================================================
    # 儲存結果
    # ============================================================
    results = {
        'basic_metrics': {
            'rmse': float(rmse),
            'mae': float(mae)
        },
        'recommended_metrics': {
            'adjacent_star_accuracy': float(adjacent_acc),
            'exact_match_accuracy': float(exact_acc),
            'half_star_accuracy': float(star_based_accuracy(y_test, y_pred, 0.5))
        },
        'tolerance_percent_analysis': results_percent,
        'star_tolerance_analysis': [
            {'tolerance': r['tolerance'], 'accuracy': r['accuracy']}
            for r in results_star
        ],
        'feature_importance': {
            col: float(imp) for col, imp in zip(SCORE_COLUMNS, importances)
        },
        'excluded_features': ['score_WER'],
        'reason': 'WER excluded for multi-language support'
    }

    return results, model, X_test, y_test, y_pred


def plot_tolerance_curve(results, output_dir):
    """
    繪製容忍區間準確率曲線
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 圖 1: 星級容忍準確率
    ax1 = axes[0]
    tolerances = [r['tolerance'] for r in results['star_tolerance_analysis']]
    accuracies = [r['accuracy'] for r in results['star_tolerance_analysis']]

    bars = ax1.bar(range(len(tolerances)), accuracies, color='#3498db', alpha=0.7, edgecolor='black')
    ax1.set_xticks(range(len(tolerances)))
    ax1.set_xticklabels([f'±{t}' for t in tolerances])
    ax1.set_xlabel('Tolerance (stars)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Accuracy (%)', fontsize=12, fontweight='bold')
    ax1.set_title('Accuracy by Star Tolerance', fontsize=14, fontweight='bold')
    ax1.set_ylim(0, 100)
    ax1.grid(True, alpha=0.3, axis='y')

    # 標記 ±1 星（推薦）
    for i, (tol, acc) in enumerate(zip(tolerances, accuracies)):
        color = 'red' if tol == 1.0 else 'black'
        weight = 'bold' if tol == 1.0 else 'normal'
        ax1.text(i, acc + 2, f'{acc:.1f}%', ha='center', va='bottom',
                fontsize=10, fontweight=weight, color=color)

    # 圖 2: 百分比容忍準確率
    ax2 = axes[1]
    percents = [r['percent'] for r in results['tolerance_percent_analysis']]
    percent_accs = [r['accuracy'] for r in results['tolerance_percent_analysis']]

    ax2.plot(percents, percent_accs, 'o-', linewidth=2, markersize=8, color='#e74c3c')
    ax2.fill_between(percents, percent_accs, alpha=0.2, color='#e74c3c')
    ax2.set_xlabel('Tolerance (%)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Accuracy (%)', fontsize=12, fontweight='bold')
    ax2.set_title('Accuracy by Percentage Tolerance', fontsize=14, fontweight='bold')
    ax2.set_ylim(0, 100)
    ax2.grid(True, alpha=0.3)

    # 標記 25%（推薦）
    for pct, acc in zip(percents, percent_accs):
        if pct == 25:
            ax2.annotate(f'{acc:.1f}%\n(±1 star)',
                        xy=(pct, acc),
                        xytext=(pct + 5, acc - 10),
                        fontsize=10, fontweight='bold', color='red',
                        arrowprops=dict(arrowstyle='->', color='red'))

    plt.tight_layout()
    output_path = os.path.join(output_dir, 'tolerance_accuracy_curves.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n✅ 圖表已儲存: {output_path}")
    plt.close()


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')
    output_dir = os.path.join(base_dir, 'results')

    results, model, X_test, y_test, y_pred = run_experiment(dataset_path)

    # 繪製圖表
    plot_tolerance_curve(results, output_dir)

    # 儲存結果
    output_path = os.path.join(output_dir, 'tolerance_accuracy_results.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"✅ 結果已儲存: {output_path}")

    print("\n" + "="*80)
    print("✅ 實驗一完成！")
    print("="*80)
