"""
生產環境準備度分析

評估當前評分模型是否適合部署到網站
"""

import json
import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scoring_service import load_model, predict_score
from collections import defaultdict

def analyze_production_readiness(dataset_path):
    """
    全面分析模型在生產環境的表現
    """
    print("="*80)
    print("評分系統生產環境準備度分析")
    print("="*80)

    # 載入模型
    print("\n載入模型...")
    load_model()

    # 載入資料
    print("載入資料集...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    rated_data = [d for d in data if d.get('rating_count', 0) > 0]
    print(f"有評分樣本數: {len(rated_data)}")

    # 準備預測
    predictions = []
    ground_truths = []
    rating_counts = []
    errors = []
    confidences = []

    required_metrics = ['score_PER', 'score_PPG', 'score_WER', 'score_GOP',
                       'score_GPE_offset', 'score_FFE', 'score_Energy', 'score_VDE']

    print("\n執行預測...")
    for item in rated_data:
        if not all(metric in item for metric in required_metrics):
            continue

        metrics = {metric: item[metric] for metric in required_metrics}

        try:
            result = predict_score(metrics)
            predictions.append(result['score'])
            ground_truths.append(item['rating_avg'])
            rating_counts.append(item['rating_count'])
            errors.append(abs(result['score'] - item['rating_avg']))
            confidences.append(result['confidence'])
        except Exception as e:
            continue

    predictions = np.array(predictions)
    ground_truths = np.array(ground_truths)
    rating_counts = np.array(rating_counts)
    errors = np.array(errors)

    # ============================================================
    # 分析 1: 整體準確度
    # ============================================================
    print("\n" + "="*80)
    print("1️⃣  整體準確度分析")
    print("="*80)

    mae = np.mean(errors)
    rmse = np.sqrt(np.mean(errors ** 2))
    median_error = np.median(errors)

    # 星級準確度
    pred_int = np.round(predictions)
    gt_int = np.round(ground_truths)
    exact_accuracy = np.mean(pred_int == gt_int)

    pred_half = np.round(predictions * 2) / 2
    gt_half = np.round(ground_truths * 2) / 2
    half_accuracy = np.mean(pred_half == gt_half)

    # 誤差在 0.5 星內的比例
    within_half_star = np.mean(errors <= 0.5)
    within_1_star = np.mean(errors <= 1.0)
    within_1_5_stars = np.mean(errors <= 1.5)

    print(f"樣本數: {len(predictions)}")
    print(f"\n精確度指標:")
    print(f"  MAE (平均絕對誤差):       {mae:.4f} 星")
    print(f"  RMSE (均方根誤差):        {rmse:.4f} 星")
    print(f"  Median Error (中位誤差):  {median_error:.4f} 星")
    print(f"\n星級準確度:")
    print(f"  整數星級準確度:           {exact_accuracy*100:.2f}%")
    print(f"  0.5 星準確度:             {half_accuracy*100:.2f}%")
    print(f"\n誤差分佈:")
    print(f"  ± 0.5 星以內:             {within_half_star*100:.2f}%  {'✅ 優秀' if within_half_star > 0.5 else '⚠️ 需改進'}")
    print(f"  ± 1.0 星以內:             {within_1_star*100:.2f}%  {'✅ 良好' if within_1_star > 0.8 else '⚠️ 需改進'}")
    print(f"  ± 1.5 星以內:             {within_1_5_stars*100:.2f}%")

    # ============================================================
    # 分析 2: 按星級分析
    # ============================================================
    print("\n" + "="*80)
    print("2️⃣  各星級預測表現分析")
    print("="*80)

    star_analysis = {}
    for star in range(1, 6):
        mask = (gt_int == star)
        if np.sum(mask) > 0:
            star_predictions = predictions[mask]
            star_errors = errors[mask]
            star_gt = ground_truths[mask]

            star_analysis[star] = {
                'count': np.sum(mask),
                'avg_prediction': np.mean(star_predictions),
                'avg_error': np.mean(star_errors),
                'exact_match_rate': np.mean(np.round(star_predictions) == star) * 100
            }

    print(f"\n{'星級':<6} {'樣本數':<8} {'平均預測':<12} {'平均誤差':<12} {'準確率':<10}")
    print("-" * 60)
    for star in range(1, 6):
        if star in star_analysis:
            s = star_analysis[star]
            indicator = "✅" if s['exact_match_rate'] > 30 else "⚠️"
            print(f"{star} 星   {s['count']:<8} {s['avg_prediction']:<12.2f} {s['avg_error']:<12.2f} {s['exact_match_rate']:<9.1f}% {indicator}")

    # 檢查偏差
    print("\n偏差分析:")
    overall_bias = np.mean(predictions - ground_truths)
    print(f"  整體偏差: {overall_bias:+.4f} 星")
    if abs(overall_bias) < 0.1:
        print(f"  ✅ 偏差很小，模型預測中立")
    elif overall_bias > 0:
        print(f"  ⚠️ 模型傾向高估評分（給分較寬鬆）")
    else:
        print(f"  ⚠️ 模型傾向低估評分（給分較嚴格）")

    # ============================================================
    # 分析 3: 按評分人數分析
    # ============================================================
    print("\n" + "="*80)
    print("3️⃣  評分可靠性分析（依評分人數）")
    print("="*80)

    reliability_analysis = {}
    for min_raters in [1, 2, 3, 5]:
        mask = rating_counts >= min_raters
        if np.sum(mask) > 0:
            reliability_analysis[min_raters] = {
                'count': np.sum(mask),
                'mae': np.mean(errors[mask]),
                'accuracy': np.mean(np.round(predictions[mask]) == np.round(ground_truths[mask])) * 100
            }

    print(f"\n{'評分人數':<10} {'樣本數':<10} {'MAE':<12} {'準確率':<10}")
    print("-" * 50)
    for min_raters in [1, 2, 3, 5]:
        if min_raters in reliability_analysis:
            r = reliability_analysis[min_raters]
            print(f"≥ {min_raters} 人     {r['count']:<10} {r['mae']:<12.4f} {r['accuracy']:<9.1f}%")

    print("\n發現:")
    if 3 in reliability_analysis and 1 in reliability_analysis:
        mae_diff = reliability_analysis[1]['mae'] - reliability_analysis[3]['mae']
        if abs(mae_diff) < 0.1:
            print("  ✅ 模型表現不受評分人數影響，穩定性高")
        else:
            print(f"  ⚠️ 評分人數較多時，MAE {'降低' if mae_diff > 0 else '提高'} {abs(mae_diff):.3f}")

    # ============================================================
    # 分析 4: 極端誤差分析
    # ============================================================
    print("\n" + "="*80)
    print("4️⃣  極端誤差案例分析")
    print("="*80)

    large_errors = errors > 1.5
    large_error_rate = np.mean(large_errors) * 100

    print(f"\n誤差 > 1.5 星的案例: {np.sum(large_errors)} 筆 ({large_error_rate:.2f}%)")

    if np.sum(large_errors) > 0:
        print(f"\n極端誤差統計:")
        print(f"  最大誤差: {np.max(errors):.2f} 星")
        print(f"  平均誤差: {np.mean(errors[large_errors]):.2f} 星")

        # 分析極端誤差的星級分佈
        large_error_stars = gt_int[large_errors]
        print(f"\n極端誤差的真實星級分佈:")
        for star in range(1, 6):
            count = np.sum(large_error_stars == star)
            if count > 0:
                print(f"  {star} 星: {count} 筆")

    risk_level = "低" if large_error_rate < 5 else "中" if large_error_rate < 10 else "高"
    print(f"\n風險等級: {risk_level}")

    # ============================================================
    # 分析 5: 信心等級分析
    # ============================================================
    print("\n" + "="*80)
    print("5️⃣  預測信心等級分析")
    print("="*80)

    confidence_stats = defaultdict(list)
    for conf, error in zip(confidences, errors):
        confidence_stats[conf].append(error)

    print(f"\n{'信心等級':<12} {'樣本數':<10} {'平均誤差':<12} {'準確率':<10}")
    print("-" * 50)

    for conf in ['high', 'medium', 'low']:
        if conf in confidence_stats:
            conf_errors = np.array(confidence_stats[conf])
            conf_mae = np.mean(conf_errors)
            conf_acc = np.mean(conf_errors <= 0.5) * 100
            print(f"{conf:<12} {len(conf_errors):<10} {conf_mae:<12.4f} {conf_acc:<9.1f}%")

    # ============================================================
    # 分析 6: 用戶體驗影響評估
    # ============================================================
    print("\n" + "="*80)
    print("6️⃣  用戶體驗影響評估")
    print("="*80)

    # 模擬用戶場景
    scenarios = {
        "完美錄音 (4-5星)": (gt_int >= 4, predictions[gt_int >= 4]),
        "良好錄音 (3星)": (gt_int == 3, predictions[gt_int == 3]),
        "需改進 (1-2星)": (gt_int <= 2, predictions[gt_int <= 2])
    }

    print("\n不同品質錄音的預測分佈:")
    for scenario_name, (mask, preds) in scenarios.items():
        if len(preds) > 0:
            avg_pred = np.mean(preds)
            std_pred = np.std(preds)
            print(f"\n{scenario_name}:")
            print(f"  樣本數: {len(preds)}")
            print(f"  平均預測: {avg_pred:.2f} ± {std_pred:.2f} 星")

            # 預測分佈
            for star in range(1, 6):
                count = np.sum((preds >= star - 0.5) & (preds < star + 0.5))
                pct = count / len(preds) * 100
                bar = "█" * int(pct / 5)
                print(f"  {star}星: {pct:5.1f}% {bar}")

    # ============================================================
    # 最終建議
    # ============================================================
    print("\n" + "="*80)
    print("7️⃣  生產環境部署建議")
    print("="*80)

    # 評分標準
    score = 0
    max_score = 100

    # 準確度 (40分)
    if within_1_star >= 0.9:
        score += 40
        acc_grade = "A+"
    elif within_1_star >= 0.85:
        score += 35
        acc_grade = "A"
    elif within_1_star >= 0.8:
        score += 30
        acc_grade = "B+"
    elif within_1_star >= 0.7:
        score += 25
        acc_grade = "B"
    else:
        score += 20
        acc_grade = "C"

    # 穩定性 (30分)
    if large_error_rate < 3:
        score += 30
        stab_grade = "A+"
    elif large_error_rate < 5:
        score += 25
        stab_grade = "A"
    elif large_error_rate < 10:
        score += 20
        stab_grade = "B"
    else:
        score += 15
        stab_grade = "C"

    # 偏差控制 (30分)
    if abs(overall_bias) < 0.1:
        score += 30
        bias_grade = "A+"
    elif abs(overall_bias) < 0.2:
        score += 25
        bias_grade = "A"
    elif abs(overall_bias) < 0.3:
        score += 20
        bias_grade = "B"
    else:
        score += 15
        bias_grade = "C"

    print(f"\n綜合評分: {score}/{max_score} 分")
    print(f"\n細項評級:")
    print(f"  準確度:   {acc_grade} ({within_1_star*100:.1f}% 在 ±1 星內)")
    print(f"  穩定性:   {stab_grade} ({large_error_rate:.1f}% 極端誤差)")
    print(f"  偏差控制: {bias_grade} (偏差 {overall_bias:+.3f} 星)")

    print(f"\n" + "="*80)

    if score >= 80:
        recommendation = "✅ 強烈建議部署"
        details = """
模型表現優秀，可以直接上線使用：
  • 準確度高，大部分預測在 ±1 星誤差內
  • 極端誤差少，用戶體驗風險低
  • 偏差小，評分公平

建議措施：
  1. 直接整合到網站評分系統
  2. 顯示預測分數給用戶作為參考
  3. 持續收集用戶反饋，監控表現
  4. 每週檢視誤差案例
        """
    elif score >= 70:
        recommendation = "⚠️ 建議有條件部署"
        details = """
模型表現良好，但建議採取保守策略：
  • 準確度可接受，但有改進空間
  • 部分極端誤差需要注意

建議措施：
  1. 先進行 A/B 測試（20-30% 用戶）
  2. 搭配人工評分作為備援
  3. 對極端誤差案例進行人工審核
  4. 顯示信心等級，讓用戶知道預測可靠度
  5. 收集 2-4 週數據後全面上線
        """
    else:
        recommendation = "❌ 暫不建議部署"
        details = """
模型表現尚有明顯不足，建議先改進：
  • 準確度或穩定性未達標
  • 用戶體驗風險較高

建議措施：
  1. 提取新的音訊特徵（音高、語速、停頓）
  2. 嘗試 XGBoost 或其他進階模型
  3. 收集更多高品質訓練資料
  4. 只使用 ≥3 位評分者的資料重新訓練
  5. 改進後再次評估
        """

    print(f"部署建議: {recommendation}")
    print(details)

    # 儲存分析結果
    analysis_results = {
        'overall_score': score,
        'metrics': {
            'mae': float(mae),
            'rmse': float(rmse),
            'median_error': float(median_error),
            'exact_accuracy': float(exact_accuracy),
            'within_1_star': float(within_1_star),
            'within_half_star': float(within_half_star),
            'large_error_rate': float(large_error_rate),
            'overall_bias': float(overall_bias)
        },
        'grades': {
            'accuracy': acc_grade,
            'stability': stab_grade,
            'bias_control': bias_grade
        },
        'recommendation': recommendation.replace('✅ ', '').replace('⚠️ ', '').replace('❌ ', ''),
        'sample_count': len(predictions)
    }

    return analysis_results


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')

    results = analyze_production_readiness(dataset_path)

    # 儲存結果
    output_path = os.path.join(base_dir, 'results/production_readiness.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅ 分析結果已儲存至: {output_path}")
