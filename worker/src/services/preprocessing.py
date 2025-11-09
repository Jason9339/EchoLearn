"""
音訊前處理模組
提供統一的音訊前處理流程：正規化 → 降噪 → LUFS 增益
"""

import subprocess
import tempfile
from pathlib import Path

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
    src_path: str | Path,
    out_path: str | Path,
    *,
    target_sr: int = 16000,
    target_peak_dbfs: float = -3.0,
    target_lufs: float = -16.0,
    use_deepfilter: bool = False,
) -> Path:
    """
    統一音訊前處理流程：正規化 → 降噪 → LUFS 增益

    Steps:
    1. 峰值正規化到 -3 dBFS + 轉單聲道/16kHz
    2. (可選) DeepFilterNet 降噪
    3. LUFS 正規化到 -16 LUFS

    Args:
        src_path: 輸入音檔路徑
        out_path: 輸出音檔路徑
        target_sr: 目標採樣率 (預設 16000)
        target_peak_dbfs: 目標峰值 dBFS (預設 -3.0)
        target_lufs: 目標響度 LUFS (預設 -16.0)
        use_deepfilter: 是否使用 DeepFilterNet 降噪 (預設 False，需安裝 deepfilternet)

    Returns:
        輸出檔案路徑 (Path 物件)

    Example:
        >>> from services.preprocessing import preprocess_pipeline
        >>> cleaned = preprocess_pipeline("raw.wav", "clean.wav")
        >>> # 使用降噪
        >>> cleaned = preprocess_pipeline("raw.wav", "clean.wav", use_deepfilter=True)
    """
    src_path = str(src_path)
    out_path = str(out_path)

    with tempfile.TemporaryDirectory() as td:
        step1 = f"{td}/step1.wav"
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
                _run_command(["df", "-i", step1, "-o", step2])
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("Warning: DeepFilterNet not available, skipping noise reduction")
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
