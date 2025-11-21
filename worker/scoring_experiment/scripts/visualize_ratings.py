"""
視覺化使用者評分分佈

生成：
1. Box Plot (箱型圖) - 顯示評分分佈、中位數、四分位數、離群值
2. Histogram (直方圖) - 顯示評分頻率分佈
"""

import json
import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# 設定中文字體
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 設定 seaborn 樣式
sns.set_style("whitegrid")
sns.set_palette("husl")


def load_ratings(dataset_path):
    """
    載入使用者評分資料
    """
    print("載入資料集...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # 提取評分資料
    all_ratings = []
    ratings_with_count = {1: [], 2: [], 3: [], '4+': []}

    for item in data:
        if 'rating_avg' in item and item.get('rating_count', 0) > 0:
            rating = item['rating_avg']
            count = item['rating_count']

            all_ratings.append(rating)

            # 按評分人數分組
            if count == 1:
                ratings_with_count[1].append(rating)
            elif count == 2:
                ratings_with_count[2].append(rating)
            elif count == 3:
                ratings_with_count[3].append(rating)
            else:
                ratings_with_count['4+'].append(rating)

    print(f"總評分數: {len(all_ratings)}")
    print(f"  1 位評分者: {len(ratings_with_count[1])} 筆")
    print(f"  2 位評分者: {len(ratings_with_count[2])} 筆")
    print(f"  3 位評分者: {len(ratings_with_count[3])} 筆")
    print(f"  4+ 位評分者: {len(ratings_with_count['4+'])} 筆")

    return np.array(all_ratings), ratings_with_count


def plot_rating_distribution(ratings, ratings_by_count, output_dir):
    """
    繪製評分分佈圖
    """
    print("\n繪製視覺化圖表...")

    # 創建 figure with subplots
    fig = plt.figure(figsize=(16, 10))

    # ============================================================
    # 1. Box Plot - 整體評分分佈
    # ============================================================
    ax1 = plt.subplot(2, 3, 1)

    box = ax1.boxplot([ratings],
                       vert=True,
                       patch_artist=True,
                       widths=0.5,
                       showmeans=True,
                       meanprops=dict(marker='D', markerfacecolor='red', markersize=8))

    # 美化 box plot
    box['boxes'][0].set_facecolor('#3498db')
    box['boxes'][0].set_alpha(0.7)
    box['medians'][0].set_color('red')
    box['medians'][0].set_linewidth(2)

    ax1.set_ylabel('評分 (星)', fontsize=12, fontweight='bold')
    ax1.set_title('整體評分分佈 (Box Plot)', fontsize=14, fontweight='bold')
    ax1.set_ylim(0.5, 5.5)
    ax1.set_yticks([1, 2, 3, 4, 5])
    ax1.grid(True, alpha=0.3)
    ax1.set_xticklabels(['所有評分'])

    # 添加統計資訊
    stats_text = f'樣本數: {len(ratings)}\n'
    stats_text += f'平均: {np.mean(ratings):.2f}\n'
    stats_text += f'中位數: {np.median(ratings):.2f}\n'
    stats_text += f'標準差: {np.std(ratings):.2f}'

    ax1.text(1.15, 0.7, stats_text,
            transform=ax1.transAxes,
            fontsize=10,
            verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    # ============================================================
    # 2. Histogram - 評分頻率分佈
    # ============================================================
    ax2 = plt.subplot(2, 3, 2)

    # 使用 0.5 星為一個 bin
    bins = np.arange(0.75, 5.76, 0.5)

    n, bins_edges, patches = ax2.hist(ratings,
                                       bins=bins,
                                       edgecolor='black',
                                       alpha=0.7,
                                       color='#2ecc71')

    # 為每個 bar 添加數字標籤
    for i, (patch, count) in enumerate(zip(patches, n)):
        height = patch.get_height()
        if count > 0:
            ax2.text(patch.get_x() + patch.get_width()/2., height,
                    f'{int(count)}',
                    ha='center', va='bottom', fontsize=9)

    ax2.set_xlabel('評分 (星)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('頻率', fontsize=12, fontweight='bold')
    ax2.set_title('評分頻率分佈 (Histogram)', fontsize=14, fontweight='bold')
    ax2.set_xticks([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])
    ax2.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 3. 整數星級分佈 (Bar Chart)
    # ============================================================
    ax3 = plt.subplot(2, 3, 3)

    # 四捨五入到整數星級
    ratings_int = np.round(ratings).astype(int)
    star_counts = [np.sum(ratings_int == i) for i in range(1, 6)]
    star_percentages = [count / len(ratings) * 100 for count in star_counts]

    colors = ['#e74c3c', '#e67e22', '#f39c12', '#2ecc71', '#27ae60']
    bars = ax3.bar(range(1, 6), star_counts, color=colors, alpha=0.7, edgecolor='black')

    # 添加百分比標籤
    for i, (bar, pct) in enumerate(zip(bars, star_percentages)):
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}\n({pct:.1f}%)',
                ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax3.set_xlabel('星級', fontsize=12, fontweight='bold')
    ax3.set_ylabel('數量', fontsize=12, fontweight='bold')
    ax3.set_title('整數星級分佈', fontsize=14, fontweight='bold')
    ax3.set_xticks(range(1, 6))
    ax3.set_xticklabels(['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'])
    ax3.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 4. Box Plot - 依評分人數分組
    # ============================================================
    ax4 = plt.subplot(2, 3, 4)

    # 準備資料
    data_by_count = [ratings_by_count[1], ratings_by_count[2],
                     ratings_by_count[3], ratings_by_count['4+']]
    labels = ['1 位', '2 位', '3 位', '4+ 位']

    # 過濾掉空的群組
    filtered_data = []
    filtered_labels = []
    for data, label in zip(data_by_count, labels):
        if len(data) > 0:
            filtered_data.append(data)
            filtered_labels.append(label)

    box2 = ax4.boxplot(filtered_data,
                       labels=filtered_labels,
                       patch_artist=True,
                       showmeans=True,
                       meanprops=dict(marker='D', markerfacecolor='red', markersize=6))

    # 為每個 box 設定不同顏色
    colors_box = ['#3498db', '#9b59b6', '#e74c3c', '#f39c12']
    for patch, color in zip(box2['boxes'], colors_box[:len(filtered_data)]):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    ax4.set_xlabel('評分人數', fontsize=12, fontweight='bold')
    ax4.set_ylabel('評分 (星)', fontsize=12, fontweight='bold')
    ax4.set_title('不同評分人數的評分分佈', fontsize=14, fontweight='bold')
    ax4.set_ylim(0.5, 5.5)
    ax4.set_yticks([1, 2, 3, 4, 5])
    ax4.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 5. Violin Plot - 評分密度分佈
    # ============================================================
    ax5 = plt.subplot(2, 3, 5)

    parts = ax5.violinplot([ratings],
                           positions=[1],
                           showmeans=True,
                           showmedians=True,
                           widths=0.7)

    # 美化 violin plot
    for pc in parts['bodies']:
        pc.set_facecolor('#e91e63')
        pc.set_alpha(0.7)

    ax5.set_ylabel('評分 (星)', fontsize=12, fontweight='bold')
    ax5.set_title('評分密度分佈 (Violin Plot)', fontsize=14, fontweight='bold')
    ax5.set_ylim(0.5, 5.5)
    ax5.set_yticks([1, 2, 3, 4, 5])
    ax5.set_xticks([1])
    ax5.set_xticklabels(['所有評分'])
    ax5.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 6. 累積分佈圖 (CDF)
    # ============================================================
    ax6 = plt.subplot(2, 3, 6)

    # 計算 CDF
    sorted_ratings = np.sort(ratings)
    cumulative = np.arange(1, len(sorted_ratings) + 1) / len(sorted_ratings) * 100

    ax6.plot(sorted_ratings, cumulative, linewidth=2, color='#9c27b0')
    ax6.fill_between(sorted_ratings, cumulative, alpha=0.3, color='#9c27b0')

    # 添加參考線
    for star in [1, 2, 3, 4, 5]:
        pct = np.sum(ratings <= star) / len(ratings) * 100
        ax6.axhline(y=pct, color='gray', linestyle='--', alpha=0.5, linewidth=1)
        ax6.axvline(x=star, color='gray', linestyle='--', alpha=0.5, linewidth=1)

        # 標註百分比
        if pct > 5 and pct < 95:
            ax6.text(star + 0.1, pct, f'{pct:.1f}%', fontsize=9)

    ax6.set_xlabel('評分 (星)', fontsize=12, fontweight='bold')
    ax6.set_ylabel('累積百分比 (%)', fontsize=12, fontweight='bold')
    ax6.set_title('累積分佈函數 (CDF)', fontsize=14, fontweight='bold')
    ax6.set_xlim(0.5, 5.5)
    ax6.set_xticks([1, 2, 3, 4, 5])
    ax6.set_ylim(0, 100)
    ax6.grid(True, alpha=0.3)

    # ============================================================
    # 調整整體佈局
    # ============================================================
    plt.suptitle('使用者評分分析視覺化', fontsize=18, fontweight='bold', y=0.995)
    plt.tight_layout(rect=[0, 0, 1, 0.99])

    # 儲存圖表
    output_path = os.path.join(output_dir, 'rating_distribution.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✅ 圖表已儲存: {output_path}")

    plt.close()


def plot_detailed_stats(ratings, ratings_by_count, output_dir):
    """
    繪製詳細統計資訊
    """
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # ============================================================
    # 1. 評分人數分佈
    # ============================================================
    ax1 = axes[0, 0]

    counts = [len(ratings_by_count[1]), len(ratings_by_count[2]),
              len(ratings_by_count[3]), len(ratings_by_count['4+'])]
    labels_count = ['1 位', '2 位', '3 位', '4+ 位']

    bars = ax1.bar(labels_count, counts, color=['#3498db', '#9b59b6', '#e74c3c', '#f39c12'],
                   alpha=0.7, edgecolor='black')

    # 添加數字標籤
    for bar in bars:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}',
                ha='center', va='bottom', fontsize=11, fontweight='bold')

    ax1.set_xlabel('評分人數', fontsize=12, fontweight='bold')
    ax1.set_ylabel('樣本數', fontsize=12, fontweight='bold')
    ax1.set_title('評分人數分佈', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 2. 各組平均評分
    # ============================================================
    ax2 = axes[0, 1]

    avg_ratings = []
    std_ratings = []
    valid_labels = []

    for label, data in zip(labels_count, [ratings_by_count[1], ratings_by_count[2],
                                          ratings_by_count[3], ratings_by_count['4+']]):
        if len(data) > 0:
            avg_ratings.append(np.mean(data))
            std_ratings.append(np.std(data))
            valid_labels.append(label)

    x_pos = np.arange(len(valid_labels))
    bars = ax2.bar(x_pos, avg_ratings, yerr=std_ratings,
                   color=['#3498db', '#9b59b6', '#e74c3c', '#f39c12'][:len(valid_labels)],
                   alpha=0.7, edgecolor='black', capsize=5)

    # 添加數字標籤
    for i, (bar, avg, std) in enumerate(zip(bars, avg_ratings, std_ratings)):
        height = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., height + std,
                f'{avg:.2f}±{std:.2f}',
                ha='center', va='bottom', fontsize=10)

    ax2.set_xlabel('評分人數', fontsize=12, fontweight='bold')
    ax2.set_ylabel('平均評分', fontsize=12, fontweight='bold')
    ax2.set_title('不同評分人數的平均評分', fontsize=14, fontweight='bold')
    ax2.set_xticks(x_pos)
    ax2.set_xticklabels(valid_labels)
    ax2.set_ylim(0, 5.5)
    ax2.axhline(y=np.mean(ratings), color='red', linestyle='--',
                label=f'總體平均: {np.mean(ratings):.2f}', linewidth=2)
    ax2.legend()
    ax2.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 3. 評分變異係數
    # ============================================================
    ax3 = axes[1, 0]

    # 計算變異係數 (CV = std / mean)
    cv_values = []
    for data in [ratings_by_count[1], ratings_by_count[2],
                 ratings_by_count[3], ratings_by_count['4+']]:
        if len(data) > 0:
            cv = np.std(data) / np.mean(data) * 100
            cv_values.append(cv)

    bars = ax3.bar(valid_labels, cv_values,
                   color=['#3498db', '#9b59b6', '#e74c3c', '#f39c12'][:len(valid_labels)],
                   alpha=0.7, edgecolor='black')

    for bar, cv in zip(bars, cv_values):
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height,
                f'{cv:.1f}%',
                ha='center', va='bottom', fontsize=10)

    ax3.set_xlabel('評分人數', fontsize=12, fontweight='bold')
    ax3.set_ylabel('變異係數 (%)', fontsize=12, fontweight='bold')
    ax3.set_title('評分一致性分析 (變異係數越低越一致)', fontsize=14, fontweight='bold')
    ax3.grid(True, alpha=0.3, axis='y')

    # ============================================================
    # 4. 統計摘要表
    # ============================================================
    ax4 = axes[1, 1]
    ax4.axis('off')

    # 準備表格資料
    stats_data = [
        ['統計量', '數值'],
        ['樣本數', f'{len(ratings)}'],
        ['平均值', f'{np.mean(ratings):.3f}'],
        ['中位數', f'{np.median(ratings):.3f}'],
        ['眾數', f'{float(np.round(np.bincount(np.round(ratings).astype(int)).argmax()))}'],
        ['標準差', f'{np.std(ratings):.3f}'],
        ['變異數', f'{np.var(ratings):.3f}'],
        ['最小值', f'{np.min(ratings):.3f}'],
        ['最大值', f'{np.max(ratings):.3f}'],
        ['範圍', f'{np.max(ratings) - np.min(ratings):.3f}'],
        ['Q1 (25%)', f'{np.percentile(ratings, 25):.3f}'],
        ['Q3 (75%)', f'{np.percentile(ratings, 75):.3f}'],
        ['IQR', f'{np.percentile(ratings, 75) - np.percentile(ratings, 25):.3f}'],
    ]

    table = ax4.table(cellText=stats_data,
                     cellLoc='left',
                     loc='center',
                     colWidths=[0.5, 0.5])

    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 2)

    # 美化表格
    for i in range(len(stats_data)):
        cell = table[(i, 0)]
        if i == 0:
            cell.set_facecolor('#3498db')
            cell.set_text_props(weight='bold', color='white')
            table[(i, 1)].set_facecolor('#3498db')
            table[(i, 1)].set_text_props(weight='bold', color='white')
        else:
            cell.set_facecolor('#ecf0f1' if i % 2 == 0 else 'white')

    ax4.set_title('統計摘要', fontsize=14, fontweight='bold', pad=20)

    plt.tight_layout()

    # 儲存圖表
    output_path = os.path.join(output_dir, 'rating_statistics.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✅ 統計圖表已儲存: {output_path}")

    plt.close()


def main():
    """
    主函數
    """
    # 路徑設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')
    output_dir = os.path.join(base_dir, 'results')

    print("="*80)
    print("使用者評分視覺化")
    print("="*80)

    # 載入資料
    ratings, ratings_by_count = load_ratings(dataset_path)

    # 列印基本統計
    print("\n基本統計:")
    print(f"  平均值: {np.mean(ratings):.3f} 星")
    print(f"  中位數: {np.median(ratings):.3f} 星")
    print(f"  標準差: {np.std(ratings):.3f}")
    print(f"  範圍: {np.min(ratings):.2f} - {np.max(ratings):.2f}")

    # 繪製圖表
    print("\n" + "="*80)
    plot_rating_distribution(ratings, ratings_by_count, output_dir)
    plot_detailed_stats(ratings, ratings_by_count, output_dir)

    print("\n" + "="*80)
    print("✅ 所有視覺化圖表已完成！")
    print("="*80)
    print(f"\n圖表位置: {output_dir}/")
    print("  - rating_distribution.png (評分分佈圖)")
    print("  - rating_statistics.png (統計資訊圖)")


if __name__ == '__main__':
    main()
