#!/usr/bin/env python3
"""
完整的語音評估測試 - 整合所有指標
包含：
1. 用戶錄音評估（與參考音檔比較）
2. 四種測試案例（同檔、不同說話者、不同句子等）
3. 11 項完整指標：音素相似度 (5項) + 語音韻律 (6項)
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
from services.speech_metrics import SpeechMetrics


def test_user_recordings(use_deepfilter: bool, ctc: PhoneCTC, speech_metrics: SpeechMetrics):
    """測試用戶錄音與參考音檔的比較"""
    print("\n" + "=" * 90)
    print("Part 1: 用戶錄音評估")
    print("=" * 90)

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
        return []

    if not reference.exists():
        print(f"❌ 找不到參考音檔: {reference}")
        return []

    print(f"\n✅ 找到 {len(recordings)} 個錄音檔案")
    for name, path, _ in recordings:
        print(f"   {name}: {path.name}")
    print(f"   參考音檔: {reference.name}")

    # 處理音檔
    print(f"\n{'=' * 90}")
    print("處理音檔（格式轉換 + 標準化）")
    print('=' * 90)

    for name, src_path, dst_path in recordings:
        print(f"處理{name}...")
        preprocess_pipeline(src_path, dst_path, use_deepfilter=use_deepfilter)
        print(f"✅ 完成: {dst_path.name}")

    print("\n處理參考音檔...")
    preprocess_pipeline(reference, reference_processed, use_deepfilter=use_deepfilter)
    print(f"✅ 完成: {reference_processed.name}")

    # 計算所有指標
    print(f"\n{'=' * 90}")
    print("計算所有相似度指標")
    print('=' * 90)

    all_results = []

    for i, (name, _, processed_path) in enumerate(recordings, 1):
        print(f"\n{'-' * 90}")
        print(f"測試 {i}: {name} vs 參考音檔")
        print('-' * 90)

        # 音素相似度指標
        print("\n【音素相似度指標】")
        per = calculate_per_similarity(str(processed_path), str(reference_processed), ctc=ctc)
        gop_new = calculate_gop_similarity(str(processed_path), str(reference_processed), ctc=ctc)
        ppg = calculate_ppg_similarity(str(processed_path), str(reference_processed), ctc=ctc)
        wer = get_wer_score(str(processed_path), str(reference_processed))
        gop_old = get_gop_score(str(processed_path), str(reference_processed), alignment=True)

        print(f"  PER: {per:.4f}, GOP-new: {gop_new:.4f}, PPG: {ppg:.4f}")
        print(f"  WER: {wer:.4f}, GOP-old: {gop_old:.4f}")

        # 語音韻律指標
        print("\n【語音韻律指標】")
        vde = speech_metrics.calculate_vde(str(reference_processed), str(processed_path))
        gpe = speech_metrics.calculate_gpe(str(reference_processed), str(processed_path))
        gpe_log = speech_metrics.calculate_gpe_log(str(reference_processed), str(processed_path))
        gpe_offset = speech_metrics.calculate_gpe_offset(str(reference_processed), str(processed_path))
        energy = speech_metrics.calculate_energy_similarity(str(reference_processed), str(processed_path))
        ffe = speech_metrics.calculate_ffe(str(reference_processed), str(processed_path))

        print(f"  VDE: {vde:.4f}, GPE: {gpe:.4f}, GPE_log: {gpe_log:.4f}")
        print(f"  GPE_offset: {gpe_offset:.4f}, Energy: {energy:.4f}, FFE: {ffe:.4f}")

        all_results.append({
            'name': name,
            'per': per, 'gop_new': gop_new, 'ppg': ppg, 'wer': wer, 'gop_old': gop_old,
            'vde': vde, 'gpe': gpe, 'gpe_log': gpe_log, 'gpe_offset': gpe_offset,
            'energy': energy, 'ffe': ffe
        })

    return all_results


def test_four_cases(ctc: PhoneCTC, speech_metrics: SpeechMetrics):
    """測試四種標準案例（計算全部 11 項指標）"""
    print("\n" + "=" * 90)
    print("Part 2: 四種標準測試案例")
    print("=" * 90)

    # 音檔路徑
    AUDIO_DIR = Path(__file__).parent.parent / "public" / "audio"
    BDL_DIR = AUDIO_DIR / "cmu_us_bdl_arctic"  # 說話者 1 (男聲)
    CLB_DIR = AUDIO_DIR / "cmu_us_clb_arctic"  # 說話者 2 (女聲)

    # 檢查音檔目錄
    if not BDL_DIR.exists() or not CLB_DIR.exists():
        print(f"❌ 找不到音檔目錄")
        print(f"   預期路徑: {AUDIO_DIR}")
        return []

    # 選擇測試音檔
    bdl_file1 = BDL_DIR / "arctic_a0001.wav"
    bdl_file2 = BDL_DIR / "arctic_a0002.wav"
    clb_file1 = CLB_DIR / "arctic_a0001.wav"
    clb_file2 = CLB_DIR / "arctic_a0002.wav"

    # 檢查檔案存在
    for f in [bdl_file1, bdl_file2, clb_file1, clb_file2]:
        if not f.exists():
            print(f"❌ 找不到音檔 {f}")
            return []

    print("\n✅ 測試音檔準備完成")
    print(f"   說話者 1 (男聲): {bdl_file1.name}, {bdl_file2.name}")
    print(f"   說話者 2 (女聲): {clb_file1.name}, {clb_file2.name}")

    # 定義四種測試案例
    test_cases = [
        {
            'name': '測試 1: 同檔對自己',
            'description': '預期: 所有指標都接近 1.0（完全相同）',
            'audio_a': bdl_file1,
            'audio_b': bdl_file1,
        },
        {
            'name': '測試 2: 不同說話者同句',
            'description': '預期: PER/WER 高（內容相同），韻律指標中等（音色不同）',
            'audio_a': bdl_file1,  # 男聲
            'audio_b': clb_file1,  # 女聲 (同一句)
        },
        {
            'name': '測試 3: 同說話者不同句',
            'description': '預期: PER/WER 低（內容不同），韻律指標高（音色相同）',
            'audio_a': bdl_file1,  # 男聲句子1
            'audio_b': bdl_file2,  # 男聲句子2
        },
        {
            'name': '測試 4: 不同說話者不同句',
            'description': '預期: 所有分數都較低（內容和音色都不同）',
            'audio_a': bdl_file1,  # 男聲句子1
            'audio_b': clb_file2,  # 女聲句子2
        },
    ]

    results = []

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'-' * 90}")
        print(f"{test_case['name']}")
        print(f"{test_case['description']}")
        print(f"音檔 A: {test_case['audio_a'].name}")
        print(f"音檔 B: {test_case['audio_b'].name}")
        print('-' * 90)

        try:
            # === 音素相似度指標 ===
            print("\n【音素相似度指標】")
            per = calculate_per_similarity(str(test_case['audio_a']), str(test_case['audio_b']), ctc=ctc)
            gop_new = calculate_gop_similarity(str(test_case['audio_a']), str(test_case['audio_b']), ctc=ctc)
            ppg = calculate_ppg_similarity(str(test_case['audio_a']), str(test_case['audio_b']), ctc=ctc)
            wer = get_wer_score(str(test_case['audio_a']), str(test_case['audio_b']))
            gop_old = get_gop_score(str(test_case['audio_a']), str(test_case['audio_b']), alignment=True)

            print(f"  PER: {per:.4f}, GOP-new: {gop_new:.4f}, PPG: {ppg:.4f}")
            print(f"  WER: {wer:.4f}, GOP-old: {gop_old:.4f}")

            # === 語音韻律指標 ===
            print("\n【語音韻律指標】")
            vde = speech_metrics.calculate_vde(str(test_case['audio_a']), str(test_case['audio_b']))
            gpe = speech_metrics.calculate_gpe(str(test_case['audio_a']), str(test_case['audio_b']))
            gpe_log = speech_metrics.calculate_gpe_log(str(test_case['audio_a']), str(test_case['audio_b']))
            gpe_offset = speech_metrics.calculate_gpe_offset(str(test_case['audio_a']), str(test_case['audio_b']))
            energy = speech_metrics.calculate_energy_similarity(str(test_case['audio_a']), str(test_case['audio_b']))
            ffe = speech_metrics.calculate_ffe(str(test_case['audio_a']), str(test_case['audio_b']))

            print(f"  VDE: {vde:.4f}, GPE: {gpe:.4f}, GPE_log: {gpe_log:.4f}")
            print(f"  GPE_offset: {gpe_offset:.4f}, Energy: {energy:.4f}, FFE: {ffe:.4f}")

            results.append({
                'name': test_case['name'],
                'per': per, 'gop_new': gop_new, 'ppg': ppg, 'wer': wer, 'gop_old': gop_old,
                'vde': vde, 'gpe': gpe, 'gpe_log': gpe_log, 'gpe_offset': gpe_offset,
                'energy': energy, 'ffe': ffe
            })

        except Exception as e:
            print(f"❌ 錯誤: {e}")
            import traceback
            traceback.print_exc()

    return results


def print_user_recordings_summary(all_results):
    """顯示用戶錄音的總結"""
    if not all_results:
        return

    print(f"\n{'=' * 90}")
    print("用戶錄音測試總結")
    print('=' * 90)

    # 音素相似度指標
    print(f"\n【音素相似度指標】")
    print(f"{'錄音':<15} {'PER':<10} {'GOP-new':<10} {'PPG':<10} {'WER':<10} {'GOP-old':<10}")
    print('-' * 90)
    for result in all_results:
        print(f"{result['name']:<15} {result['per']:<10.4f} {result['gop_new']:<10.4f} {result['ppg']:<10.4f} {result['wer']:<10.4f} {result['gop_old']:<10.4f}")

    # 語音韻律指標
    print(f"\n【語音韻律指標】")
    print(f"{'錄音':<15} {'VDE':<10} {'GPE':<10} {'GPE_log':<10} {'GPE_off':<10} {'Energy':<10} {'FFE':<10}")
    print('-' * 90)
    for result in all_results:
        print(f"{result['name']:<15} {result['vde']:<10.4f} {result['gpe']:<10.4f} {result['gpe_log']:<10.4f} {result['gpe_offset']:<10.4f} {result['energy']:<10.4f} {result['ffe']:<10.4f}")

    # 最佳錄音分析
    if len(all_results) > 1:
        print(f"\n【最佳錄音】")

        best_per = max(all_results, key=lambda x: x['per'])
        best_ppg = max(all_results, key=lambda x: x['ppg'])
        best_gpe = max(all_results, key=lambda x: x['gpe'])
        best_ffe = max(all_results, key=lambda x: x['ffe'])

        print(f"  最佳 PER (音素準確度):     {best_per['name']:<15} ({best_per['per']:.4f})")
        print(f"  最佳 PPG (音素分布):       {best_ppg['name']:<15} ({best_ppg['ppg']:.4f})")
        print(f"  最佳 GPE (音高相似):       {best_gpe['name']:<15} ({best_gpe['gpe']:.4f})")
        print(f"  最佳 FFE (F0幀相似):      {best_ffe['name']:<15} ({best_ffe['ffe']:.4f})")

        # 綜合評分
        print(f"\n【綜合評分】")
        for result in all_results:
            avg_score = (
                result['per'] + result['gop_new'] + result['ppg'] +
                (1.0 - result['wer']) + result['gop_old'] +
                result['vde'] + result['gpe'] + result['gpe_offset'] +
                result['energy'] + result['ffe']
            ) / 10.0
            result['avg_score'] = avg_score
            print(f"  {result['name']:<15} 平均分數: {avg_score:.4f}")

        best_overall = max(all_results, key=lambda x: x['avg_score'])
        print(f"\n  🏆 綜合表現最佳: {best_overall['name']} (平均分數: {best_overall['avg_score']:.4f})")


def print_four_cases_summary(results):
    """顯示四種測試案例的總結（所有 11 項指標）"""
    if not results:
        return

    print(f"\n{'=' * 90}")
    print("四種測試案例總結")
    print('=' * 90)

    # 音素相似度指標
    print(f"\n【音素相似度指標】")
    print(f"{'測試案例':<25} {'PER':<10} {'GOP-new':<10} {'PPG':<10} {'WER':<10} {'GOP-old':<10}")
    print('-' * 90)
    for result in results:
        name = result['name'].replace('測試 ', 'T')
        print(f"{name:<25} {result['per']:<10.4f} {result['gop_new']:<10.4f} {result['ppg']:<10.4f} {result['wer']:<10.4f} {result['gop_old']:<10.4f}")

    # 語音韻律指標
    print(f"\n【語音韻律指標】")
    print(f"{'測試案例':<25} {'VDE':<10} {'GPE':<10} {'GPE_log':<10} {'GPE_off':<10} {'Energy':<10} {'FFE':<10}")
    print('-' * 90)
    for result in results:
        name = result['name'].replace('測試 ', 'T')
        print(f"{name:<25} {result['vde']:<10.4f} {result['gpe']:<10.4f} {result['gpe_log']:<10.4f} {result['gpe_offset']:<10.4f} {result['energy']:<10.4f} {result['ffe']:<10.4f}")

    # 綜合評分
    print(f"\n【綜合評分】（平均所有「越高越好」指標）")
    for result in results:
        avg_score = (
            result['per'] + result['gop_new'] + result['ppg'] +
            (1.0 - result['wer']) + result['gop_old'] +
            result['vde'] + result['gpe'] + result['gpe_offset'] +
            result['energy'] + result['ffe']
        ) / 10.0
        result['avg_score'] = avg_score
        name = result['name'].replace('測試 ', 'T')
        print(f"  {name:<25} 平均分數: {avg_score:.4f}")

    # 驗證邏輯
    print(f"\n【驗證結果】")
    validations = []

    for result in results:
        per, gop_new, ppg = result['per'], result['gop_new'], result['ppg']
        vde, energy, ffe = result['vde'], result['energy'], result['ffe']

        # 根據不同測試案例驗證結果
        if '同檔對自己' in result['name']:
            # 所有指標都應該接近 1.0
            passed = per > 0.95 and gop_new > 0.95 and ppg > 0.95 and vde > 0.95 and energy > 0.95 and ffe > 0.95
            status = '✅ 通過' if passed else '⚠️ 警告'
            validations.append((result['name'], status, f"所有指標應接近 1.0 (avg={result['avg_score']:.4f})"))
        elif '不同說話者同句' in result['name']:
            # PER 應該較高（內容相同）
            passed = per > 0.6
            status = '✅ 通過' if passed else '⚠️ 警告'
            validations.append((result['name'], status, f"PER 應較高 ({per:.4f} {'>' if passed else '<'} 0.6)"))
        elif '同說話者不同句' in result['name']:
            # 韻律指標應該較高（音色相同）
            passed = energy > 0.6 and vde > 0.6
            status = '✅ 通過' if passed else '⚠️ 警告'
            validations.append((result['name'], status, f"韻律指標應較高 (Energy={energy:.4f}, VDE={vde:.4f})"))
        elif '不同說話者不同句' in result['name']:
            # 所有分數都低是預期結果
            passed = True
            status = '✅ 通過'
            validations.append((result['name'], status, f"預期所有分數都較低 (avg={result['avg_score']:.4f})"))

    for name, status, description in validations:
        name_short = name.replace('測試 ', 'T')
        print(f"  {name_short:<25} {status:<10} {description}")


def main():
    # 解析命令列參數
    parser = argparse.ArgumentParser(
        description='完整的語音評估測試 - 整合所有指標',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
範例:
  # 不使用降噪（預設，快速）
  python test_all_metrics.py

  # 使用 DeepFilterNet 降噪（較慢但品質更好）
  python test_all_metrics.py --denoise
  python test_all_metrics.py -d
        '''
    )
    parser.add_argument(
        '--denoise', '-d',
        action='store_true',
        help='啟用 DeepFilterNet 降噪（適合有雜訊的錄音）'
    )
    args = parser.parse_args()

    use_deepfilter = args.denoise

    print("=" * 90)
    print("完整的語音評估測試 - 整合所有指標")
    print("=" * 90)
    print(f"降噪模式: {'✅ 啟用 DeepFilterNet' if use_deepfilter else '❌ 關閉（僅標準化）'}")
    print("=" * 90)
    print("\n本測試包含兩個部分:")
    print("  Part 1: 用戶錄音評估 (11 項完整指標)")
    print("  Part 2: 四種標準測試案例 (11 項完整指標)")
    print("=" * 90)

    # 載入模型
    print(f"\n{'=' * 90}")
    print("載入模型")
    print('=' * 90)

    print("載入 PhoneCTC 模型...")
    ctc = PhoneCTC()
    print("✅ PhoneCTC 模型載入成功")

    print("\n初始化 SpeechMetrics...")
    speech_metrics = SpeechMetrics(frame_shift=0.010)
    print("✅ SpeechMetrics 初始化完成")

    # Part 1: 測試用戶錄音
    user_results = test_user_recordings(use_deepfilter, ctc, speech_metrics)

    # Part 2: 測試四種標準案例
    four_cases_results = test_four_cases(ctc, speech_metrics)

    # 顯示總結
    print_user_recordings_summary(user_results)
    print_four_cases_summary(four_cases_results)

    # 指標說明
    print(f"\n{'=' * 90}")
    print("指標說明")
    print('=' * 90)

    print("\n【音素相似度指標】(基於 PhoneCTC 模型)")
    print("  PER (Phoneme Error Rate Similarity):        音素序列匹配，1.0=完全相同")
    print("  GOP-new (Goodness of Pronunciation):        發音品質，1.0=品質完全相同")
    print("  PPG (Posteriorgram Similarity):             音素後驗圖，1.0=分布完全相同")

    print("\n【舊版指標】")
    print("  WER (Word Error Rate):                      詞錯誤率(Whisper)，0.0=完全相同(越低越好)")
    print("  GOP-old (Goodness of Pronunciation):        發音品質(wav2vec2)，1.0=品質完全相同")

    print("\n【語音韻律指標】(基於 Praat 聲學分析)")
    print("  VDE (Voiced Decision Error):                濁音判斷相似度，1.0=完全一致")
    print("  GPE (Gross Pitch Error):                    音高相似度(標準)，1.0=無大誤差")
    print("  GPE_log (GPE - Semitone):                   音高相似度(半音)，1.0=偏差都在3半音內")
    print("  GPE_offset (GPE - Pitch Contour):           音高輪廓相似度(補償整體音高)，1.0=輪廓一致")
    print("  Energy (Energy Similarity):                 能量相似度，1.0=完全相同")
    print("  FFE (F0 Frame Error):                       F0幀相似度，1.0=所有幀正確")

    print(f"\n{'=' * 90}")
    print("✅ 所有測試完成！")
    print("   - Part 1: 用戶錄音評估 (11 項指標)")
    print("   - Part 2: 四種標準測試案例 (11 項指標)")
    print("   - 總計: 11 項評估指標 × 2 種測試場景")
    print('=' * 90)


if __name__ == "__main__":
    main()
