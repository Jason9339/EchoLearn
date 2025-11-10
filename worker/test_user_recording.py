#!/usr/bin/env python3
"""
測試用戶錄音與參考音檔的音素相似度
並輸出處理後的音檔
"""

import sys
from pathlib import Path

# 確保可以 import services
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.phoneme_ctc import PhoneCTC
from services.phoneme_per import calculate_per_similarity
from services.phoneme_gop import calculate_gop_similarity
from services.phoneme_ppg import calculate_ppg_similarity
from services.preprocessing import preprocess_pipeline
import librosa
import soundfile as sf


def main():
    print("=" * 70)
    print("用戶錄音音素相似度測試")
    print("=" * 70)

    # 檔案路徑
    user_recording = Path("/home/vipl/EchoLearn/example_audio/a2736ebe-448c-450b-a5cc-370d680abd03_1_test-0_1762443387953.webm")
    reference_audio = Path("/home/vipl/EchoLearn/public/audio/cmu_us_bdl_arctic/arctic_a0001.wav")

    # 輸出檔案路徑
    output_dir = Path("/home/vipl/EchoLearn/example_audio")
    user_recording_processed = output_dir / "user_recording_processed.wav"
    reference_processed = output_dir / "reference_processed.wav"

    # 步驟 1: 使用 preprocessing 處理用戶錄音（包含格式轉換）
    print("\n步驟 1: 處理用戶錄音")
    print("-" * 70)
    print(f"輸入格式: {user_recording.suffix} (webm)")
    print(f"輸出格式: {user_recording_processed.suffix} (wav)")
    print("處理步驟: 格式轉換 → 峰值正規化 → DeepFilterNet 降噪 → LUFS 標準化")

    try:
        preprocess_pipeline(
            user_recording,  # 直接使用 webm 檔案
            user_recording_processed,
            use_deepfilter=True
        )
        print(f"✅ 處理完成！")
        print(f"   輸出檔案: {user_recording_processed}")
    except Exception as e:
        print(f"❌ 處理失敗: {e}")
        import traceback
        traceback.print_exc()
        return

    # 步驟 2: 處理參考音檔（用於公平比較）
    print("\n步驟 2: 處理參考音檔")
    print("-" * 70)
    print("處理中...")

    try:
        preprocess_pipeline(
            reference_audio,
            reference_processed,
            use_deepfilter=True
        )
        print(f"✅ 處理完成！")
        print(f"   輸出檔案: {reference_processed}")
    except Exception as e:
        print(f"❌ 處理失敗: {e}")
        import traceback
        traceback.print_exc()
        return

    # 步驟 3: 計算音素相似度
    print("\n步驟 3: 計算音素相似度")
    print("=" * 70)

    print("\n正在載入 PhoneCTC 模型...")
    try:
        ctc = PhoneCTC()
        print("✅ 模型載入成功\n")
    except Exception as e:
        print(f"❌ 模型載入失敗: {e}")
        return

    # 測試: 處理後音檔對比
    print("\n" + "=" * 70)
    print("音素相似度分析（處理後音檔）")
    print("=" * 70)
    print(f"用戶錄音: {user_recording_processed.name}")
    print(f"參考音檔: {reference_processed.name}")
    print("-" * 70)

    try:
        per = calculate_per_similarity(str(user_recording_processed), str(reference_processed), ctc=ctc)
        gop = calculate_gop_similarity(str(user_recording_processed), str(reference_processed), ctc=ctc)
        ppg = calculate_ppg_similarity(str(user_recording_processed), str(reference_processed), ctc=ctc)

        print(f"PER (音素錯誤率相似度): {per:.4f}")
        print(f"GOP (發音品質相似度):   {gop:.4f}")
        print(f"PPG (音素後驗圖相似度): {ppg:.4f}")

        print("\n指標說明:")
        print("  - PER: 基於音素序列匹配，對內容敏感 (1.0 = 完全相同)")
        print("  - GOP: 基於發音品質，對說話者和內容都敏感 (1.0 = 品質完全相同)")
        print("  - PPG: 基於音素後驗圖，最細緻的比較 (1.0 = 完全相同)")
    except Exception as e:
        print(f"❌ 計算失敗: {e}")
        import traceback
        traceback.print_exc()

    # 輸出檔案總結
    print("\n" + "=" * 70)
    print("輸出檔案")
    print("=" * 70)
    print(f"1. 處理後用戶錄音: {user_recording_processed}")
    print(f"2. 處理後參考音檔: {reference_processed}")
    print("\n處理內容: webm 格式轉換 → 峰值正規化 → DeepFilterNet 降噪 → LUFS 標準化")

    print("\n" + "=" * 70)
    print("測試完成！")
    print("=" * 70)


if __name__ == "__main__":
    main()
