#!/usr/bin/env python3
"""
音素相似度功能自測腳本
測試四種情境：同檔對自己、不同說話者同句、不同句同說話者、加噪音
"""

import sys
from pathlib import Path

# 確保可以 import services
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.phoneme_ctc import PhoneCTC
from services.phoneme_per import calculate_per_similarity
from services.phoneme_gop import calculate_gop_similarity
from services.phoneme_ppg import calculate_ppg_similarity

# 音檔路徑
AUDIO_DIR = Path(__file__).parent.parent / "public" / "audio"
BDL_DIR = AUDIO_DIR / "cmu_us_bdl_arctic"  # 說話者 1 (男聲)
CLB_DIR = AUDIO_DIR / "cmu_us_clb_arctic"  # 說話者 2 (女聲)


def test_case(name: str, audio_a: Path, audio_b: Path, ctc: PhoneCTC):
    """測試一個案例並輸出結果"""
    print(f"\n{'=' * 60}")
    print(f"測試案例: {name}")
    print(f"音檔 A: {audio_a.name}")
    print(f"音檔 B: {audio_b.name}")
    print(f"{'-' * 60}")

    try:
        # 計算三種相似度
        per = calculate_per_similarity(str(audio_a), str(audio_b), ctc=ctc)
        gop = calculate_gop_similarity(str(audio_a), str(audio_b), ctc=ctc)
        ppg = calculate_ppg_similarity(str(audio_a), str(audio_b), ctc=ctc)

        print(f"PER 相似度: {per:.4f}")
        print(f"GOP 相似度: {gop:.4f}")
        print(f"PPG 相似度: {ppg:.4f}")

        return {"per": per, "gop": gop, "ppg": ppg}
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return None


def main():
    print("=" * 60)
    print("音素相似度功能自測")
    print("=" * 60)

    # 檢查音檔目錄
    if not BDL_DIR.exists() or not CLB_DIR.exists():
        print(f"❌ 錯誤: 找不到音檔目錄")
        print(f"   預期路徑: {AUDIO_DIR}")
        return

    # 選擇測試音檔
    bdl_file1 = BDL_DIR / "arctic_a0001.wav"
    bdl_file2 = BDL_DIR / "arctic_a0002.wav"
    clb_file1 = CLB_DIR / "arctic_a0001.wav"
    clb_file2 = CLB_DIR / "arctic_a0002.wav"

    # 檢查檔案存在
    for f in [bdl_file1, bdl_file2, clb_file1, clb_file2]:
        if not f.exists():
            print(f"❌ 錯誤: 找不到音檔 {f}")
            return

    # 初始化 CTC 模型
    print("\n正在載入 PhoneCTC 模型...")
    try:
        ctc = PhoneCTC()
        print("✅ 模型載入成功")
    except Exception as e:
        print(f"❌ 模型載入失敗: {e}")
        return

    # === 測試 1: 同檔對自己 (應該接近 1.0) ===
    print("\n" + "=" * 60)
    print("測試 1: 同檔對自己 (預期: 三個分數都接近 1.0)")
    print("=" * 60)
    result1 = test_case(
        "同檔對自己",
        bdl_file1,
        bdl_file1,
        ctc
    )

    # === 測試 2: 不同說話者同句 (PER 高、GOP/PPG 中等) ===
    print("\n" + "=" * 60)
    print("測試 2: 不同說話者念同一句 (預期: PER 較高、GOP/PPG 中等)")
    print("=" * 60)
    result2 = test_case(
        "不同說話者同句",
        bdl_file1,  # 男聲
        clb_file1,  # 女聲 (同一句)
        ctc
    )

    # === 測試 3: 不同句同說話者 (PER 下降、PPG 中等偏高) ===
    print("\n" + "=" * 60)
    print("測試 3: 同說話者念不同句 (預期: PER 下降、PPG 中等偏高)")
    print("=" * 60)
    result3 = test_case(
        "不同句同說話者",
        bdl_file1,  # 男聲句子1
        bdl_file2,  # 男聲句子2
        ctc
    )

    # === 測試 4: 不同說話者不同句 (所有分數都低) ===
    print("\n" + "=" * 60)
    print("測試 4: 不同說話者不同句 (預期: 所有分數都較低)")
    print("=" * 60)
    result4 = test_case(
        "不同說話者不同句",
        bdl_file1,  # 男聲句子1
        clb_file2,  # 女聲句子2
        ctc
    )

    # === 總結 ===
    print("\n" + "=" * 60)
    print("測試總結")
    print("=" * 60)

    if all([result1, result2, result3, result4]):
        print("\n✅ 所有測試完成！")
        print("\n預期結果驗證:")
        print(f"  1. 同檔對自己:")
        print(f"     PER={result1['per']:.4f} (應接近 1.0) {'✅' if result1['per'] > 0.95 else '⚠️'}")
        print(f"     GOP={result1['gop']:.4f} (應接近 1.0) {'✅' if result1['gop'] > 0.95 else '⚠️'}")
        print(f"     PPG={result1['ppg']:.4f} (應接近 1.0) {'✅' if result1['ppg'] > 0.95 else '⚠️'}")

        print(f"\n  2. 不同說話者同句:")
        print(f"     PER={result2['per']:.4f} (應較高) {'✅' if result2['per'] > 0.6 else '⚠️'}")
        print(f"     GOP={result2['gop']:.4f} (應中等)")
        print(f"     PPG={result2['ppg']:.4f} (應中等)")

        print(f"\n  3. 同說話者不同句:")
        print(f"     PER={result3['per']:.4f} (應較低)")
        print(f"     GOP={result3['gop']:.4f} (應中等偏高)")
        print(f"     PPG={result3['ppg']:.4f} (應中等偏高)")

        print(f"\n  4. 不同說話者不同句:")
        print(f"     PER={result4['per']:.4f} (應最低)")
        print(f"     GOP={result4['gop']:.4f} (應較低)")
        print(f"     PPG={result4['ppg']:.4f} (應較低)")

        print("\n說明:")
        print("  - PER: 基於音素序列匹配，對內容敏感")
        print("  - GOP: 基於發音品質，對說話者和內容都敏感")
        print("  - PPG: 基於 posteriorgram，最細緻的比較")

    else:
        print("\n❌ 部分測試失敗")

    print("\n測試完成！")


if __name__ == "__main__":
    main()
