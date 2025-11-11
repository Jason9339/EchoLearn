#!/usr/bin/env python3
"""
測試兩個用戶錄音的音素相似度
"""

import sys
import argparse
from pathlib import Path

# 確保可以 import services
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.phoneme_ctc import PhoneCTC
from services.phoneme_per import calculate_per_similarity
from services.phoneme_gop import calculate_gop_similarity
from services.phoneme_ppg import calculate_ppg_similarity
from services.preprocessing import preprocess_pipeline
from services.cal_wer_gop import get_wer_score, get_gop_score


def main():
    # 解析命令列參數
    parser = argparse.ArgumentParser(
        description='測試兩個用戶錄音的音素相似度',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
範例:
  # 不使用降噪（預設，快速）
  python test_two_recordings.py

  # 使用 DeepFilterNet 降噪（較慢但品質更好）
  python test_two_recordings.py --denoise
  python test_two_recordings.py -d
        '''
    )
    parser.add_argument(
        '--denoise', '-d',
        action='store_true',
        help='啟用 DeepFilterNet 降噪（適合有雜訊的錄音）'
    )
    args = parser.parse_args()

    use_deepfilter = args.denoise

    print("=" * 70)
    print("用戶錄音音素相似度測試")
    print("=" * 70)
    print(f"降噪模式: {'✅ 啟用 DeepFilterNet' if use_deepfilter else '❌ 關閉（僅標準化）'}")
    print("=" * 70)

    # 檔案路徑
    recording_1 = Path("/home/vipl/EchoLearn/example_audio/a2736ebe-448c-450b-a5cc-370d680abd03_1_test-0_1762443387953.webm")
    recording_2 = Path("/home/vipl/EchoLearn/example_audio/a2736ebe-448c-450b-a5cc-370d680abd03_1_test-1_1762443401800.webm")
    recording_3 = Path("/home/vipl/EchoLearn/example_audio/6935f0d5-1298-4223-885e-6d204f112343_1_test-0_1761173329238.webm")
    reference = Path("/home/vipl/EchoLearn/public/audio/cmu_us_bdl_arctic/arctic_a0001.wav")

    output_dir = Path("/home/vipl/EchoLearn/example_audio")
    recording_1_processed = output_dir / "recording_1_processed.wav"
    recording_2_processed = output_dir / "recording_2_processed.wav"
    recording_3_processed = output_dir / "recording_3_processed.wav"
    reference_processed = output_dir / "reference_processed.wav"

    # 收集存在的錄音
    recordings = []
    if recording_1.exists():
        recordings.append(("錄音 1", recording_1, recording_1_processed))
    if recording_2.exists():
        recordings.append(("錄音 2", recording_2, recording_2_processed))
    if recording_3.exists():
        recordings.append(("錄音 3", recording_3, recording_3_processed))

    if not recordings:
        print(f"❌ 找不到任何錄音檔案")
        return

    if not reference.exists():
        print(f"❌ 找不到參考音檔: {reference}")
        return

    print(f"\n✅ 找到 {len(recordings)} 個錄音檔案")
    for name, path, _ in recordings:
        print(f"   {name}: {path.name}")
    print(f"   參考音檔: {reference.name}")

    # 步驟 1: 處理音檔
    print(f"\n{'=' * 70}")
    print("步驟 1: 處理音檔（格式轉換 + 標準化）")
    print('=' * 70)
    if use_deepfilter:
        print("✅ 使用 DeepFilterNet GPU 降噪（處理時間較長）")
    else:
        print("❌ 不使用降噪（快速模式）")
        print("   提示: 如需降噪，請加上 --denoise 或 -d 參數")

    # 處理所有錄音
    for name, src_path, dst_path in recordings:
        print(f"\n處理{name}...")
        preprocess_pipeline(src_path, dst_path, use_deepfilter=use_deepfilter)
        print(f"✅ 完成: {dst_path.name}")

    print("\n處理參考音檔...")
    preprocess_pipeline(reference, reference_processed, use_deepfilter=use_deepfilter)
    print(f"✅ 完成: {reference_processed.name}")

    # 步驟 2: 載入模型
    print(f"\n{'=' * 70}")
    print("步驟 2: 載入 PhoneCTC 模型")
    print('=' * 70)
    ctc = PhoneCTC()
    print("✅ 模型載入成功")

    # 步驟 3: 計算相似度
    print(f"\n{'=' * 70}")
    print("步驟 3: 計算音素相似度")
    print('=' * 70)

    # 計算每個錄音 vs 參考音檔
    results_vs_ref = []
    for i, (name, _, processed_path) in enumerate(recordings, 1):
        print(f"\n{'-' * 70}")
        print(f"測試 {i}: {name} vs 參考音檔")
        print('-' * 70)

        # 新版指標（基於 PhoneCTC）
        per = calculate_per_similarity(str(processed_path), str(reference_processed), ctc=ctc)
        gop_new = calculate_gop_similarity(str(processed_path), str(reference_processed), ctc=ctc)
        ppg = calculate_ppg_similarity(str(processed_path), str(reference_processed), ctc=ctc)

        # 舊版指標（基於 wav2vec2）
        wer = get_wer_score(str(processed_path), str(reference_processed))
        gop_old = get_gop_score(str(processed_path), str(reference_processed), alignment=True)

        print(f"PER (音素錯誤率相似度):     {per:.4f}")
        print(f"GOP-new (發音品質相似度):   {gop_new:.4f}")
        print(f"PPG (音素後驗圖相似度):     {ppg:.4f}")
        print(f"WER (詞錯誤率):             {wer:.4f}")
        print(f"GOP-old (舊版發音品質):     {gop_old:.4f}")

        results_vs_ref.append((name, per, gop_new, ppg, wer, gop_old))

    # 總結
    print(f"\n{'=' * 70}")
    print("測試總結")
    print('=' * 70)

    print(f"\n{'測試項目':<30} {'PER':<10} {'GOP-new':<10} {'PPG':<10} {'WER':<10} {'GOP-old':<10}")
    print('-' * 90)

    # 顯示錄音 vs 參考音檔
    for name, per, gop_new, ppg, wer, gop_old in results_vs_ref:
        print(f"{f'{name} vs 參考音檔':<30} {per:<10.4f} {gop_new:<10.4f} {ppg:<10.4f} {wer:<10.4f} {gop_old:<10.4f}")

    # 分析
    print(f"\n{'=' * 70}")
    print("分析")
    print('=' * 70)

    print(f"\n【與參考音檔的相似度】")
    for name, per, gop_new, ppg, wer, gop_old in results_vs_ref:
        print(f"  {name}:")
        print(f"    PER={per:.4f}, GOP-new={gop_new:.4f}, PPG={ppg:.4f}")
        print(f"    WER={wer:.4f}, GOP-old={gop_old:.4f}")

    # 找出最佳錄音
    if len(results_vs_ref) > 1:
        best_per_idx = max(range(len(results_vs_ref)), key=lambda i: results_vs_ref[i][1])
        best_gop_new_idx = max(range(len(results_vs_ref)), key=lambda i: results_vs_ref[i][2])
        best_ppg_idx = max(range(len(results_vs_ref)), key=lambda i: results_vs_ref[i][3])
        best_wer_idx = min(range(len(results_vs_ref)), key=lambda i: results_vs_ref[i][4])  # WER 越低越好
        best_gop_old_idx = max(range(len(results_vs_ref)), key=lambda i: results_vs_ref[i][5])

        print(f"\n  → {results_vs_ref[best_per_idx][0]} 的音素準確度最高 (PER={results_vs_ref[best_per_idx][1]:.4f})")
        print(f"  → {results_vs_ref[best_gop_new_idx][0]} 的發音品質最好-新版 (GOP-new={results_vs_ref[best_gop_new_idx][2]:.4f})")
        print(f"  → {results_vs_ref[best_ppg_idx][0]} 的音素分布最接近參考音檔 (PPG={results_vs_ref[best_ppg_idx][3]:.4f})")
        print(f"  → {results_vs_ref[best_wer_idx][0]} 的詞錯誤率最低 (WER={results_vs_ref[best_wer_idx][4]:.4f})")
        print(f"  → {results_vs_ref[best_gop_old_idx][0]} 的發音品質最好-舊版 (GOP-old={results_vs_ref[best_gop_old_idx][5]:.4f})")

    print(f"\n{'=' * 70}")
    print("指標說明:")
    print('=' * 70)
    print("PER (Phoneme Error Rate Similarity):")
    print("  - 基於音素序列匹配（PhoneCTC 模型）")
    print("  - 1.0 = 完全相同, 0.0 = 完全不同")
    print("  - 衡量內容準確度")
    print("\nGOP-new (Goodness of Pronunciation Similarity - 新版):")
    print("  - 基於發音品質（PhoneCTC 模型）")
    print("  - 1.0 = 品質完全相同, 0.0 = 品質差異很大")
    print("  - 衡量發音清晰度和音質")
    print("\nPPG (Posteriorgram Similarity):")
    print("  - 基於音素後驗圖（PhoneCTC 模型，最細緻）")
    print("  - 1.0 = 完全相同, 0.0 = 完全不同")
    print("  - 衡量音素分布的相似度")
    print("\nWER (Word Error Rate):")
    print("  - 基於詞彙序列匹配（Whisper 轉錄）")
    print("  - 0.0 = 完全相同, 1.0+ = 完全不同")
    print("  - 衡量詞彙層級的錯誤率（越低越好）")
    print("\nGOP-old (Goodness of Pronunciation - 舊版):")
    print("  - 基於發音品質（wav2vec2 模型）")
    print("  - 1.0 = 品質完全相同, 0.0 = 品質差異很大")
    print("  - 衡量音素後驗分布相似度（使用 JSD + DTW）")

    print(f"\n{'=' * 70}")
    print(f"處理後的音檔已保存至: {output_dir}")
    for _, _, processed_path in recordings:
        print(f"  - {processed_path.name}")
    print(f"  - {reference_processed.name}")
    print('=' * 70)


if __name__ == "__main__":
    main()
