"""
提取新的音訊特徵
包括: 音高、語速、停頓、MFCC等
"""

import json
import os
import librosa
import numpy as np
import parselmouth
from parselmouth.praat import call
import soundfile as sf
from tqdm import tqdm

def extract_pitch_features(audio_path, ref_audio_path):
    """
    提取音高特徵

    使用 Praat Parselmouth 提取音高輪廓並比較相似度
    """
    try:
        # 載入音訊
        snd = parselmouth.Sound(audio_path)
        ref_snd = parselmouth.Sound(ref_audio_path)

        # 提取音高 (F0)
        pitch = snd.to_pitch()
        ref_pitch = ref_snd.to_pitch()

        # 提取音高值序列
        pitch_values = pitch.selected_array['frequency']
        ref_pitch_values = ref_pitch.selected_array['frequency']

        # 移除無音高的部分 (0 Hz)
        pitch_values = pitch_values[pitch_values > 0]
        ref_pitch_values = ref_pitch_values[ref_pitch_values > 0]

        if len(pitch_values) == 0 or len(ref_pitch_values) == 0:
            return {
                'pitch_correlation': 0.0,
                'pitch_mean_diff': 0.0,
                'pitch_std_diff': 0.0
            }

        # 計算統計特徵
        pitch_mean = np.mean(pitch_values)
        pitch_std = np.std(pitch_values)
        ref_pitch_mean = np.mean(ref_pitch_values)
        ref_pitch_std = np.std(ref_pitch_values)

        # 正規化音高序列
        pitch_norm = (pitch_values - pitch_mean) / (pitch_std + 1e-6)
        ref_pitch_norm = (ref_pitch_values - ref_pitch_mean) / (ref_pitch_std + 1e-6)

        # DTW 對齊後計算相關性（簡化版：使用 interpolation）
        from scipy.interpolate import interp1d

        # 將兩個序列插值到相同長度
        target_len = min(len(pitch_norm), len(ref_pitch_norm))
        x_pitch = np.linspace(0, 1, len(pitch_norm))
        x_ref = np.linspace(0, 1, len(ref_pitch_norm))
        x_new = np.linspace(0, 1, target_len)

        f_pitch = interp1d(x_pitch, pitch_norm, kind='linear')
        f_ref = interp1d(x_ref, ref_pitch_norm, kind='linear')

        pitch_aligned = f_pitch(x_new)
        ref_aligned = f_ref(x_new)

        # 計算相關係數
        correlation = np.corrcoef(pitch_aligned, ref_aligned)[0, 1]

        # 均值差異（半音）
        mean_diff_semitones = abs(12 * np.log2(pitch_mean / (ref_pitch_mean + 1e-6)))

        return {
            'pitch_correlation': float(correlation) if not np.isnan(correlation) else 0.0,
            'pitch_mean_diff_semitones': float(mean_diff_semitones),
            'pitch_std_ratio': float(pitch_std / (ref_pitch_std + 1e-6))
        }

    except Exception as e:
        print(f"Error extracting pitch from {audio_path}: {e}")
        return {
            'pitch_correlation': 0.0,
            'pitch_mean_diff_semitones': 0.0,
            'pitch_std_ratio': 1.0
        }


def extract_speech_rate_features(audio_path, ref_audio_path):
    """
    提取語速特徵

    計算每秒音節數 (syllables per second) 的比率
    使用能量包絡來估計
    """
    try:
        # 載入音訊
        y, sr = librosa.load(audio_path, sr=None)
        ref_y, ref_sr = librosa.load(ref_audio_path, sr=None)

        # 計算 onset strength (音節邊界)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        ref_onset_env = librosa.onset.onset_strength(y=ref_y, sr=ref_sr)

        # 偵測 onsets
        onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        ref_onsets = librosa.onset.onset_detect(onset_envelope=ref_onset_env, sr=ref_sr)

        # 計算語速 (onsets per second)
        duration = librosa.get_duration(y=y, sr=sr)
        ref_duration = librosa.get_duration(y=ref_y, sr=ref_sr)

        speech_rate = len(onsets) / (duration + 1e-6)
        ref_speech_rate = len(ref_onsets) / (ref_duration + 1e-6)

        # 語速比率
        rate_ratio = speech_rate / (ref_speech_rate + 1e-6)

        # 時長比率
        duration_ratio = duration / (ref_duration + 1e-6)

        return {
            'speech_rate_ratio': float(rate_ratio),
            'duration_ratio': float(duration_ratio),
            'onset_density': float(speech_rate)
        }

    except Exception as e:
        print(f"Error extracting speech rate from {audio_path}: {e}")
        return {
            'speech_rate_ratio': 1.0,
            'duration_ratio': 1.0,
            'onset_density': 0.0
        }


def extract_pause_features(audio_path, ref_audio_path):
    """
    提取停頓特徵

    分析靜音段落的分佈
    """
    try:
        # 載入音訊
        y, sr = librosa.load(audio_path, sr=None)
        ref_y, ref_sr = librosa.load(ref_audio_path, sr=None)

        # 偵測非靜音區間
        intervals = librosa.effects.split(y, top_db=30)
        ref_intervals = librosa.effects.split(ref_y, top_db=30)

        # 計算停頓（靜音段）
        if len(intervals) > 1:
            pauses = []
            for i in range(len(intervals) - 1):
                pause_start = intervals[i][1]
                pause_end = intervals[i + 1][0]
                pause_duration = (pause_end - pause_start) / sr
                pauses.append(pause_duration)
        else:
            pauses = []

        if len(ref_intervals) > 1:
            ref_pauses = []
            for i in range(len(ref_intervals) - 1):
                pause_start = ref_intervals[i][1]
                pause_end = ref_intervals[i + 1][0]
                pause_duration = (pause_end - pause_start) / ref_sr
                ref_pauses.append(pause_duration)
        else:
            ref_pauses = []

        # 停頓數量比率
        pause_count_ratio = len(pauses) / (len(ref_pauses) + 1e-6)

        # 平均停頓時長比率
        avg_pause = np.mean(pauses) if len(pauses) > 0 else 0
        ref_avg_pause = np.mean(ref_pauses) if len(ref_pauses) > 0 else 0
        pause_duration_ratio = avg_pause / (ref_avg_pause + 1e-6)

        return {
            'pause_count_ratio': float(pause_count_ratio),
            'pause_duration_ratio': float(pause_duration_ratio),
            'pause_count': len(pauses)
        }

    except Exception as e:
        print(f"Error extracting pauses from {audio_path}: {e}")
        return {
            'pause_count_ratio': 1.0,
            'pause_duration_ratio': 1.0,
            'pause_count': 0
        }


def extract_mfcc_features(audio_path, ref_audio_path):
    """
    提取 MFCC 特徵並計算相似度
    """
    try:
        # 載入音訊
        y, sr = librosa.load(audio_path, sr=16000)
        ref_y, ref_sr = librosa.load(ref_audio_path, sr=16000)

        # 提取 MFCC (13 coefficients)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        ref_mfcc = librosa.feature.mfcc(y=ref_y, sr=ref_sr, n_mfcc=13)

        # DTW 距離
        from scipy.spatial.distance import euclidean
        from fastdtw import fastdtw

        # 計算每個係數的 DTW 距離
        dtw_distances = []
        for i in range(13):
            distance, _ = fastdtw(mfcc[i], ref_mfcc[i], dist=euclidean)
            dtw_distances.append(distance)

        avg_dtw_distance = np.mean(dtw_distances)

        # 轉換為相似度分數 (0-1, 越高越好)
        mfcc_similarity = 1 / (1 + avg_dtw_distance / 1000)

        return {
            'mfcc_similarity': float(mfcc_similarity),
            'mfcc_dtw_distance': float(avg_dtw_distance)
        }

    except Exception as e:
        # fastdtw 可能沒安裝，改用簡單的歐式距離
        try:
            y, sr = librosa.load(audio_path, sr=16000)
            ref_y, ref_sr = librosa.load(ref_audio_path, sr=16000)

            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            ref_mfcc = librosa.feature.mfcc(y=ref_y, sr=ref_sr, n_mfcc=13)

            # 簡單統計距離
            mfcc_mean = np.mean(mfcc, axis=1)
            ref_mfcc_mean = np.mean(ref_mfcc, axis=1)

            euclidean_dist = np.linalg.norm(mfcc_mean - ref_mfcc_mean)
            similarity = 1 / (1 + euclidean_dist)

            return {
                'mfcc_similarity': float(similarity),
                'mfcc_dtw_distance': float(euclidean_dist)
            }
        except Exception as e2:
            print(f"Error extracting MFCC from {audio_path}: {e2}")
            return {
                'mfcc_similarity': 0.0,
                'mfcc_dtw_distance': 999.0
            }


def process_dataset(dataset_path, output_path, limit=None):
    """
    處理整個資料集，提取新特徵
    """
    print("載入資料集...")
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    if limit:
        data = data[:limit]
        print(f"限制處理前 {limit} 筆資料")

    print(f"開始處理 {len(data)} 筆資料...")

    enhanced_data = []

    for item in tqdm(data, desc="提取新特徵"):
        recording_path = item['recording_audio']
        reference_path = item['reference_audio']

        # 檢查檔案是否存在
        if not os.path.exists(recording_path):
            # 嘗試相對路徑
            recording_path = os.path.join('../temp/dataset/audio/recordings',
                                         os.path.basename(recording_path))

        if not os.path.exists(recording_path) or not os.path.exists(reference_path):
            print(f"跳過: 檔案不存在 - {recording_path}")
            continue

        # 提取新特徵
        pitch_features = extract_pitch_features(recording_path, reference_path)
        rate_features = extract_speech_rate_features(recording_path, reference_path)
        pause_features = extract_pause_features(recording_path, reference_path)
        mfcc_features = extract_mfcc_features(recording_path, reference_path)

        # 合併特徵
        enhanced_item = {**item,
                        **pitch_features,
                        **rate_features,
                        **pause_features,
                        **mfcc_features}

        enhanced_data.append(enhanced_item)

    # 儲存增強後的資料
    print(f"\n儲存 {len(enhanced_data)} 筆增強資料到 {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(enhanced_data, f, indent=2, ensure_ascii=False)

    print("✅ 完成！")


if __name__ == '__main__':
    # 取得腳本所在目錄
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # scoring_experiment/
    worker_dir = os.path.dirname(base_dir)   # worker/

    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')
    output_path = os.path.join(base_dir, 'data/enhanced_dataset.json')

    # 處理全部資料
    print("開始處理完整資料集")
    process_dataset(dataset_path, output_path)
