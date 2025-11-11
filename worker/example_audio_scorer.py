#!/usr/bin/env python3
"""
AudioScorer 使用範例
展示如何使用統一的評分介面來評估語音品質
"""

import sys
from pathlib import Path

# 添加 src 到路徑
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.audio_scorer import AudioScorer


def main():
    print("=" * 80)
    print("AudioScorer 使用範例")
    print("=" * 80)
    print()

    # 初始化評分器（只需要初始化一次）
    scorer = AudioScorer()
    print()

    # 準備測試音檔
    project_root = Path(__file__).parent.parent
    bdl_dir = project_root / "public" / "audio" / "cmu_us_bdl_arctic"

    # 取得兩個音檔
    audio_files = sorted(bdl_dir.glob("arctic_a*.wav"))[:2]
    if len(audio_files) < 2:
        print("❌ 需要至少 2 個音檔來測試")
        return

    reference = audio_files[0]
    test_audio = audio_files[1]

    print(f"參考音檔: {reference.name}")
    print(f"測試音檔: {test_audio.name}")
    print()

    # ===== 範例 1: 基本用法 =====
    print("=" * 80)
    print("範例 1: 基本用法")
    print("=" * 80)
    print()

    scores = scorer.score(reference, test_audio)

    print("評分結果:")
    for metric, score in scores.items():
        print(f"  {metric:12s}: {score:.4f}")

    avg = sum(scores.values()) / len(scores)
    print(f"\n  平均分數: {avg:.4f} ({avg:.2%})")
    print()

    # ===== 範例 2: 找出弱點 =====
    print("=" * 80)
    print("範例 2: 診斷需要改進的指標")
    print("=" * 80)
    print()

    weak_points = sorted(scores.items(), key=lambda x: x[1])[:3]
    print("最需要改進的 3 個指標:")
    for metric, score in weak_points:
        if score < 0.90:
            print(f"  ❗ {metric:12s}: {score:.2%}")
        else:
            print(f"  ✓ {metric:12s}: {score:.2%}")
    print()

    # ===== 範例 3: 完整評估報告 =====
    print("=" * 80)
    print("範例 3: 完整評估報告")
    print("=" * 80)
    print()

    # 同檔測試（理想情況）
    print("測試：同檔對自己")
    print("-" * 80)
    same_scores = scorer.score(reference, reference)

    print("\n【音素準確度】")
    print(f"  PER 相似度:        {same_scores['PER']:>6.2%}  (音素序列匹配)")
    print(f"  PPG 相似度:        {same_scores['PPG']:>6.2%}  (音素分佈)")
    print(f"  GOP 發音質量:      {same_scores['GOP']:>6.2%}  (發音品質)")

    print("\n【韻律特徵】")
    print(f"  音高輪廓:          {same_scores['GPE_offset']:>6.2%}  (補償音高差異)")
    print(f"  F0 準確度:         {same_scores['FFE']:>6.2%}  (綜合音高評估)")
    print(f"  能量變化:          {same_scores['Energy']:>6.2%}  (音量模式)")
    print(f"  濁音判斷:          {same_scores['VDE']:>6.2%}  (濁音準確度)")

    print("\n【語音識別】")
    print(f"  WER 相似度:        {same_scores['WER']:>6.2%}  (詞彙準確度)")

    print("\n【總體評分】")
    same_avg = sum(same_scores.values()) / len(same_scores)
    print(f"  平均分數:          {same_avg:>6.2%}")

    # 評級
    if same_avg >= 0.95:
        grade = "優秀 ⭐⭐⭐⭐⭐"
        comment = "發音非常標準，各方面表現極佳"
    elif same_avg >= 0.85:
        grade = "良好 ⭐⭐⭐⭐"
        comment = "發音良好，僅有少數需改進之處"
    elif same_avg >= 0.75:
        grade = "中等 ⭐⭐⭐"
        comment = "發音尚可，建議加強練習"
    else:
        grade = "需改進 ⭐⭐"
        comment = "建議多加練習，特別注意發音準確度"

    print(f"  評級:              {grade}")
    print(f"  評語:              {comment}")
    print()

    # ===== 範例 4: 批次評分 =====
    print("=" * 80)
    print("範例 4: 批次評分多個錄音")
    print("=" * 80)
    print()

    # 使用前 3 個音檔進行批次測試
    test_files = audio_files[:3] if len(audio_files) >= 3 else audio_files

    print(f"參考音檔: {reference.name}")
    print()

    results = []
    for i, test_file in enumerate(test_files, 1):
        print(f"[{i}/{len(test_files)}] 評分: {test_file.name}")
        scores = scorer.score(reference, test_file)
        avg_score = sum(scores.values()) / len(scores)
        results.append((test_file.name, avg_score))
        print(f"    平均分數: {avg_score:.4f} ({avg_score:.2%})")

    print()
    print("-" * 80)

    # 找出最佳錄音
    best = max(results, key=lambda x: x[1])
    print(f"✅ 最佳錄音: {best[0]} (分數: {best[1]:.2%})")
    print()

    print("=" * 80)
    print("✅ 所有範例執行完成！")
    print("=" * 80)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
