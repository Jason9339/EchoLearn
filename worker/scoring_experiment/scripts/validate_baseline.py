"""
驗證 Baseline 模型在真實資料上的表現
"""

import json
import os
import sys
import numpy as np
from scoring_service import load_model, predict_score

def validate_on_dataset(dataset_path, limit=50):
    """
    在真實資料集上驗證模型表現
    """
    print("載入模型...")
    load_model()

    print(f"載入資料集: {dataset_path}")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # 只取有評分的資料
    rated_data = [d for d in data if d.get('rating_count', 0) > 0]
    print(f"有評分的樣本數: {len(rated_data)}")

    if limit:
        rated_data = rated_data[:limit]
        print(f"限制驗證前 {limit} 筆")

    predictions = []
    ground_truths = []
    errors = []

    print("\n開始驗證...")
    for i, item in enumerate(rated_data):
        # 檢查是否有所有必要指標
        required_metrics = ['score_PER', 'score_PPG', 'score_WER', 'score_GOP',
                          'score_GPE_offset', 'score_FFE', 'score_Energy', 'score_VDE']

        if not all(metric in item for metric in required_metrics):
            continue

        metrics = {metric: item[metric] for metric in required_metrics}

        try:
            result = predict_score(metrics)
            predictions.append(result['score'])
            ground_truths.append(item['rating_avg'])
            errors.append(abs(result['score'] - item['rating_avg']))

            if i < 10:  # 顯示前 10 筆
                print(f"\n第 {i+1} 筆:")
                print(f"  真實評分: {item['rating_avg']:.2f} 星 (來自 {item['rating_count']} 位評分者)")
                print(f"  預測評分: {result['score']:.2f} 星")
                print(f"  誤差: {errors[-1]:.2f} 星")
                print(f"  信心: {result['confidence']}")

        except Exception as e:
            print(f"第 {i+1} 筆預測失敗: {e}")
            continue

    # 計算統計資料
    predictions = np.array(predictions)
    ground_truths = np.array(ground_truths)
    errors = np.array(errors)

    mae = np.mean(errors)
    rmse = np.sqrt(np.mean(errors ** 2))

    # 星級準確度
    pred_int = np.round(predictions)
    gt_int = np.round(ground_truths)
    exact_accuracy = np.mean(pred_int == gt_int)

    pred_half = np.round(predictions * 2) / 2
    gt_half = np.round(ground_truths * 2) / 2
    half_accuracy = np.mean(pred_half == gt_half)

    print("\n" + "="*60)
    print("驗證結果統計")
    print("="*60)
    print(f"驗證樣本數: {len(predictions)}")
    print(f"MAE (平均絕對誤差): {mae:.4f} 星")
    print(f"RMSE (均方根誤差): {rmse:.4f} 星")
    print(f"整數星級準確度: {exact_accuracy*100:.2f}%")
    print(f"0.5 星準確度: {half_accuracy*100:.2f}%")

    # 誤差分佈
    print(f"\n誤差分佈:")
    print(f"  < 0.5 星: {np.sum(errors < 0.5) / len(errors) * 100:.1f}%")
    print(f"  < 1.0 星: {np.sum(errors < 1.0) / len(errors) * 100:.1f}%")
    print(f"  < 1.5 星: {np.sum(errors < 1.5) / len(errors) * 100:.1f}%")
    print(f"  >= 2.0 星: {np.sum(errors >= 2.0) / len(errors) * 100:.1f}%")

    # 預測分數分佈
    print(f"\n預測分數分佈:")
    for star in range(1, 6):
        count = np.sum((predictions >= star - 0.5) & (predictions < star + 0.5))
        print(f"  {star} 星: {count} 筆 ({count/len(predictions)*100:.1f}%)")

    return {
        'mae': mae,
        'rmse': rmse,
        'exact_accuracy': exact_accuracy,
        'half_accuracy': half_accuracy,
        'sample_count': len(predictions)
    }


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')

    # 先驗證前 100 筆
    print("=" * 60)
    print("Baseline 模型驗證")
    print("=" * 60)

    results = validate_on_dataset(dataset_path, limit=100)

    print("\n✅ 驗證完成")
