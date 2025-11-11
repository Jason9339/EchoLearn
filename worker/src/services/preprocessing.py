"""
音訊前處理模組
提供統一的音訊前處理流程：正規化 → 降噪 → LUFS 增益
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Union

import librosa
import numpy as np
import soundfile as sf

# Optional dependencies
try:
    import pyloudnorm as pyln
    HAS_PYLOUDNORM = True
except ImportError:
    HAS_PYLOUDNORM = False


def _run_command(cmd: list[str]) -> None:
    """Run a shell command and raise on failure."""
    subprocess.run(cmd, check=True)


def preprocess_pipeline(
    src_path: Union[str, Path],
    out_path: Union[str, Path],
    *,
    target_sr: int = 16000,
    target_peak_dbfs: float = -3.0,
    target_lufs: float = -16.0,
    use_deepfilter: bool = False,
) -> Path:
    """
    統一音訊前處理流程：格式轉換 → 正規化 → 降噪 → LUFS 增益

    Steps:
    1. 自動格式轉換（支援 wav, mp3, flac, ogg, webm 等多種格式）+ 轉單聲道/目標採樣率
    2. 峰值正規化到 -3 dBFS
    3. (可選) DeepFilterNet 降噪
    4. LUFS 正規化到 -16 LUFS

    Args:
        src_path: 輸入音檔路徑（支援 wav, mp3, flac, ogg, webm, m4a 等格式）
        out_path: 輸出音檔路徑（.wav 格式）
        target_sr: 目標採樣率 (預設 16000)
        target_peak_dbfs: 目標峰值 dBFS (預設 -3.0)
        target_lufs: 目標響度 LUFS (預設 -16.0)
        use_deepfilter: 是否使用 DeepFilterNet 降噪 (預設 False)
            - True: 啟用 GPU 降噪（需安裝 deepfilternet，處理較慢但音質更好）
            - False: 僅進行峰值和 LUFS 正規化（快速，適合乾淨音檔）

    Returns:
        輸出檔案路徑 (Path 物件)

    Example:
        >>> from services.preprocessing import preprocess_pipeline
        >>> # 預設會使用 DeepFilterNet 降噪，自動處理 webm 格式
        >>> cleaned = preprocess_pipeline("recording.webm", "clean.wav")
        >>> # 處理 mp3 檔案
        >>> cleaned = preprocess_pipeline("audio.mp3", "clean.wav")
        >>> # 關閉降噪
        >>> cleaned = preprocess_pipeline("raw.wav", "clean.wav", use_deepfilter=False)

    Note:
        librosa.load() 會自動處理格式轉換，支援的格式取決於安裝的音訊後端
        (soundfile, audioread, ffmpeg 等)。常見格式如 wav, mp3, webm, ogg 都支援。
    """
    src_path = str(src_path)
    out_path = str(out_path)

    with tempfile.TemporaryDirectory() as td:
        step1 = f"{td}/step1.wav"
        step1_48k = f"{td}/step1_48k.wav" if use_deepfilter else None
        step2 = f"{td}/step2.wav" if use_deepfilter else step1
        step3 = out_path

        # Step 1: 峰值正規化到 -3 dBFS + 轉單聲道/16kHz
        # 使用 librosa 確保準確的峰值控制
        y, sr = librosa.load(src_path, sr=target_sr, mono=True)
        peak = float(np.max(np.abs(y)) + 1e-9)
        target_amp = 10 ** (target_peak_dbfs / 20)  # -3 dBFS -> ~0.707
        gain = min(target_amp / peak, 10.0)  # 限制最大增益避免極端放大
        y = y * gain
        sf.write(step1, y, target_sr)

        # Step 2: DeepFilterNet 降噪 (可選)
        if use_deepfilter:
            try:
                # DeepFilterNet 需要 48kHz 音訊
                # Step 2a: 轉換為 48kHz
                y_48k, _ = librosa.load(step1, sr=48000, mono=True)
                sf.write(step1_48k, y_48k, 48000)

                # Step 2b: 使用 Python API 進行降噪
                import torch as torch_df
                from df import enhance, init_df

                model, df_state, _ = init_df()
                # 轉換為 torch.Tensor 並增加 batch 維度
                audio_tensor = torch_df.from_numpy(y_48k).float().unsqueeze(0)
                audio_enhanced = enhance(model, df_state, audio_tensor)
                # 移除 batch 維度並轉回 numpy
                if isinstance(audio_enhanced, torch_df.Tensor):
                    audio_enhanced = audio_enhanced.squeeze(0).cpu().numpy()

                # Step 2c: 轉回目標採樣率
                # 先寫入 48kHz 檔案
                temp_enhanced_48k = f"{td}/enhanced_48k.wav"
                sf.write(temp_enhanced_48k, audio_enhanced, 48000)
                # 再轉回 target_sr
                y_enhanced, _ = librosa.load(temp_enhanced_48k, sr=target_sr, mono=True)
                sf.write(step2, y_enhanced, target_sr)
            except (ImportError, Exception) as e:
                print(f"Warning: DeepFilterNet not available ({e}), skipping noise reduction")
                step2 = step1

        # Step 3: LUFS 正規化
        if HAS_PYLOUDNORM:
            # 使用 pyloudnorm (更簡單直接)
            y, sr = librosa.load(step2, sr=target_sr, mono=True)
            meter = pyln.Meter(sr)
            loudness = meter.integrated_loudness(y)
            gain = target_lufs - loudness
            y_norm = y * (10 ** (gain / 20))

            # 防止 clipping
            mx = np.max(np.abs(y_norm))
            if mx > 0.999:
                y_norm = y_norm / mx * 0.999

            sf.write(step3, y_norm, sr)
        else:
            # Fallback: 簡單增益調整
            y, sr = librosa.load(step2, sr=target_sr, mono=True)
            # 估算當前響度並調整
            rms = np.sqrt(np.mean(y ** 2))
            target_rms = 10 ** (target_lufs / 20) * 0.1  # 粗略轉換
            if rms > 1e-6:
                y_norm = y * (target_rms / rms)
                mx = np.max(np.abs(y_norm))
                if mx > 0.999:
                    y_norm = y_norm / mx * 0.999
                sf.write(step3, y_norm, sr)
            else:
                sf.write(step3, y, sr)

    return Path(out_path)
