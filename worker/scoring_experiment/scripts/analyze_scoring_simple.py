"""
分析評分資料集（不依賴 pandas）
"""

import json
import statistics
from collections import Counter, defaultdict

# 載入資料
print("載入資料...")
with open('worker/temp/dataset/dataset.json', 'r') as f:
    data = json.load(f)

# 過濾有評分的資料
rated_data = [d for d in data if d.get('rating_count', 0) > 0]

print(f"總樣本數: {len(data)}")
print(f"有評分的樣本數: {len(rated_data)}")
print(f"無評分的樣本數: {len(data) - len(rated_data)}")
print()

# ============================================
# 1. 人工評分分佈分析
# ============================================
print("=" * 60)
print("1. 人工評分分佈分析")
print("=" * 60)

ratings = [d['rating_avg'] for d in rated_data]

print("\n人工評分統計:")
print(f"  數量: {len(ratings)}")
print(f"  均值: {statistics.mean(ratings):.4f}")
print(f"  中位數: {statistics.median(ratings):.4f}")
print(f"  標準差: {statistics.stdev(ratings):.4f}")
print(f"  最小值: {min(ratings):.4f}")
print(f"  最大值: {max(ratings):.4f}")

# 評分分佈（四捨五入到0.5）
rating_bins = Counter([round(r * 2) / 2 for r in ratings])
print("\n評分分佈 (四捨五入到0.5):")
for rating in sorted(rating_bins.keys()):
    count = rating_bins[rating]
    bar = '█' * int(count / 10)
    print(f"  {rating:.1f}: {count:4d} {bar}")

# 評分者數量分佈
rating_counts = Counter([d['rating_count'] for d in rated_data])
print("\n評分者數量分佈:")
for count in sorted(rating_counts.keys()):
    num = rating_counts[count]
    print(f"  {count} 位評分者: {num} 個樣本")

# 可靠性分析
reliable_samples = [d for d in rated_data if d['rating_count'] >= 3]
print(f"\n評分者 >= 3 的樣本: {len(reliable_samples)} / {len(rated_data)} ({len(reliable_samples)/len(rated_data)*100:.1f}%)")

# Ground Truth 建議
print("\n✅ Ground Truth 評估:")
if len(reliable_samples) / len(rated_data) >= 0.8:
    print("   大部分樣本有足夠的評分者（>=3人），人工評分可作為可靠的 ground truth")
else:
    print("   ⚠️  建議只使用評分者 >= 3 的樣本作為訓練資料")

# ============================================
# 2. 各指標與人工評分的相關性
# ============================================
print("\n" + "=" * 60)
print("2. 各指標與人工評分的相關性分析")
print("=" * 60)

score_columns = ['score_PER', 'score_PPG', 'score_GOP', 'score_WER',
                 'score_GPE_offset', 'score_FFE', 'score_Energy', 'score_VDE']

# 指標含義
metric_info = {
    'score_PER': {'desc': '音素錯誤率 (Phoneme Error Rate)', 'reverse': True},
    'score_PPG': {'desc': '音素後驗概率 (Phoneme Posterior Gram)', 'reverse': False},
    'score_GOP': {'desc': '發音質量分數 (Goodness of Pronunciation)', 'reverse': False},
    'score_WER': {'desc': '詞錯誤率 (Word Error Rate)', 'reverse': True},
    'score_GPE_offset': {'desc': 'GPE 偏移量', 'reverse': False},
    'score_FFE': {'desc': '幀級特徵相似度', 'reverse': False},
    'score_Energy': {'desc': '能量相似度', 'reverse': False},
    'score_VDE': {'desc': '語音時長相似度', 'reverse': False}
}

def pearson_correlation(x, y):
    """計算 Pearson 相關係數"""
    n = len(x)
    mean_x = statistics.mean(x)
    mean_y = statistics.mean(y)

    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    denominator_x = sum((x[i] - mean_x) ** 2 for i in range(n))
    denominator_y = sum((y[i] - mean_y) ** 2 for i in range(n))

    if denominator_x == 0 or denominator_y == 0:
        return 0

    return numerator / (denominator_x * denominator_y) ** 0.5

correlations = {}

for metric in score_columns:
    # 提取分數（處理缺失值）
    scores = []
    ratings_for_metric = []

    for d in rated_data:
        if metric in d and d[metric] is not None:
            score = d[metric]
            # 如果是 error rate，反轉（越低越好 -> 越高越好）
            if metric_info[metric]['reverse']:
                score = 1 - score
            scores.append(score)
            ratings_for_metric.append(d['rating_avg'])

    if len(scores) > 0:
        corr = pearson_correlation(scores, ratings_for_metric)
        correlations[metric] = corr

        mean_score = statistics.mean(scores)
        std_score = statistics.stdev(scores) if len(scores) > 1 else 0

        print(f"\n{metric}")
        print(f"  {metric_info[metric]['desc']}")
        print(f"  方向: {'反轉 (Error Rate)' if metric_info[metric]['reverse'] else '正向 (越高越好)'}")
        print(f"  均值: {mean_score:.4f}, 標準差: {std_score:.4f}")
        print(f"  相關係數: {corr:.4f}", end='')

        if abs(corr) > 0.5:
            print(" ✅ 強相關")
        elif abs(corr) > 0.3:
            print(" ✓ 中等相關")
        else:
            print(" ⚠️  弱相關")

# 排序
sorted_metrics = sorted(correlations.items(), key=lambda x: abs(x[1]), reverse=True)

print("\n\n指標重要性排序（依相關係數）:")
print("-" * 60)
for i, (metric, corr) in enumerate(sorted_metrics, 1):
    desc = metric_info[metric]['desc'].split('(')[0].strip()
    stars = '★' * int(abs(corr) * 5)
    print(f"{i}. {metric:20s} {desc:20s} r={corr:7.4f} {stars}")

# ============================================
# 3. 儲存分析結果
# ============================================
analysis_results = {
    'rating_statistics': {
        'count': len(ratings),
        'mean': statistics.mean(ratings),
        'median': statistics.median(ratings),
        'std': statistics.stdev(ratings),
        'min': min(ratings),
        'max': max(ratings)
    },
    'metric_correlations': {
        metric: {
            'correlation': corr,
            'description': metric_info[metric]['desc'],
            'reverse': metric_info[metric]['reverse']
        }
        for metric, corr in correlations.items()
    },
    'metric_ranking': [
        {
            'rank': i,
            'metric': metric,
            'correlation': corr,
            'abs_correlation': abs(corr)
        }
        for i, (metric, corr) in enumerate(sorted_metrics, 1)
    ],
    'recommendations': {
        'use_all_ratings': len(reliable_samples) / len(rated_data) >= 0.8,
        'top_3_metrics': [m for m, _ in sorted_metrics[:3]],
        'weak_metrics': [m for m, c in correlations.items() if abs(c) < 0.3]
    }
}

with open('worker/temp/dataset/analysis_results.json', 'w', encoding='utf-8') as f:
    json.dump(analysis_results, f, indent=2, ensure_ascii=False)

print("\n\n✅ 分析結果已儲存至: worker/temp/dataset/analysis_results.json")
print("=" * 60)
