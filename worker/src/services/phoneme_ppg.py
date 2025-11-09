"""
PPG (Posteriorgram) 相似度計算
基於 frame-level posteriorgram 的 JSD + DTW 發音相似度評估
"""

from pathlib import Path

import numpy as np
import torch
import torchaudio

from .phoneme_ctc import PhoneCTC


def _jsd_divergence(p: np.ndarray, q: np.ndarray, eps: float = 1e-12) -> float:
    """
    計算 Jensen-Shannon Divergence

    JSD 是對稱的機率分佈距離度量，範圍 [0, log(2)]

    Args:
        p: 機率分佈 P
        q: 機率分佈 Q
        eps: 數值穩定性參數

    Returns:
        JSD 距離值

    Example:
        >>> p = np.array([0.5, 0.3, 0.2])
        >>> q = np.array([0.4, 0.4, 0.2])
        >>> jsd = _jsd_divergence(p, q)
        >>> print(f"JSD: {jsd:.4f}")
    """
    m = 0.5 * (p + q)
    kl_pm = ((p + eps) * (np.log(p + eps) - np.log(m + eps))).sum()
    kl_qm = ((q + eps) * (np.log(q + eps) - np.log(m + eps))).sum()
    return float(0.5 * (kl_pm + kl_qm))


def _dtw_distance(D: np.ndarray) -> float:
    """
    計算 DTW 距離

    Args:
        D: 成本矩陣 [N, M]

    Returns:
        正規化的 DTW 距離

    Example:
        >>> D = np.random.rand(10, 12)
        >>> dist = _dtw_distance(D)
        >>> print(f"DTW distance: {dist:.4f}")
    """
    n, m = D.shape
    acc = np.full((n + 1, m + 1), np.inf, dtype=np.float32)
    acc[0, 0] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            acc[i, j] = D[i - 1, j - 1] + min(acc[i - 1, j], acc[i, j - 1], acc[i - 1, j - 1])

    return float(acc[n, m] / (n + m))


def _ppg_jsd_similarity(
    logp_a: torch.Tensor,
    logp_b: torch.Tensor,
    metric: str = "jsd",
    band: int | None = None,
    downsample: int = 3,
) -> float:
    """
    計算兩個 posteriorgram 之間的相似度

    Args:
        logp_a: Log-posteriorgram A [T_a, V]
        logp_b: Log-posteriorgram B [T_b, V]
        metric: 距離度量 ("jsd" 或 "cosine")
        band: DTW band constraint (None = 全局對齊)
        downsample: 下採樣因子以加速計算

    Returns:
        相似度分數 [0, 1]

    Example:
        >>> logp_a, _ = ctc.posteriors_and_spans(wav_a, sr_a)
        >>> logp_b, _ = ctc.posteriors_and_spans(wav_b, sr_b)
        >>> sim = _ppg_jsd_similarity(logp_a, logp_b)
        >>> print(f"Similarity: {sim:.4f}")
    """
    # 轉換為機率分佈
    Pa = logp_a.exp().numpy()
    Pb = logp_b.exp().numpy()

    # 下採樣
    if downsample > 1:
        Pa = Pa[::downsample]
        Pb = Pb[::downsample]

    na, nb = len(Pa), len(Pb)
    D = np.zeros((na, nb), dtype=np.float32)

    # 計算 frame-wise 距離矩陣
    if metric == "jsd":
        for i in range(na):
            if band is not None:
                j0 = max(0, i - band)
                j1 = min(nb, i + band + 1)
                D[i, :] = 1e6  # 設定 band 外的為大值
                for j in range(j0, j1):
                    D[i, j] = _jsd_divergence(Pa[i], Pb[j])
            else:
                for j in range(nb):
                    D[i, j] = _jsd_divergence(Pa[i], Pb[j])
    else:  # cosine
        for i in range(na):
            for j in range(nb):
                cos_sim = (Pa[i] * Pb[j]).sum() / (
                    np.linalg.norm(Pa[i]) * np.linalg.norm(Pb[j]) + 1e-9
                )
                D[i, j] = 1.0 - cos_sim

    # 使用 DTW 計算對齊距離
    dist = _dtw_distance(D)

    # 轉換為相似度，加入 clamp 避免數值問題
    similarity = np.exp(-dist)
    return float(max(0.0, min(1.0, similarity)))


def calculate_ppg_similarity(
    audio_a_path: str | Path,
    audio_b_path: str | Path,
    ctc: PhoneCTC | None = None,
    metric: str = "jsd",
    band: int | None = 100,
    downsample: int = 3,
) -> float:
    """
    計算兩段語音的 PPG 相似度

    基於 frame-level posteriorgram 的 JSD + DTW
    最細緻的發音比較，適合精確評估發音細節

    Args:
        audio_a_path: 音檔 A 路徑
        audio_b_path: 音檔 B 路徑
        ctc: PhoneCTC 實例 (可選，重用以節省載入時間)
        metric: 距離度量 ("jsd" 或 "cosine")
            - "jsd": Jensen-Shannon Divergence (預設，更適合機率分佈)
            - "cosine": Cosine distance (計算較快)
        band: DTW band constraint (預設 100)
            - None: 全局對齊 (最準確但最慢)
            - 整數: 限制對齊範圍 (加速計算)
        downsample: 下採樣因子 (預設 3)
            - 1: 不下採樣 (最準確但最慢)
            - 3-5: 平衡速度和準確度

    Returns:
        相似度分數 [0, 1]
        - 1.0 表示 posteriorgram 分佈完全一致
        - 0.0 表示分佈差異很大

    Raises:
        ImportError: 如果未安裝 transformers 套件

    Example:
        >>> from services.phoneme_ppg import calculate_ppg_similarity
        >>>
        >>> # 基本用法 (快速)
        >>> score = calculate_ppg_similarity("student.wav", "reference.wav")
        >>> print(f"PPG Similarity: {score:.4f}")
        >>>
        >>> # 高精度 (慢)
        >>> score = calculate_ppg_similarity(
        ...     "student.wav", "reference.wav",
        ...     band=None,       # 全局對齊
        ...     downsample=1,    # 不下採樣
        ...     metric="jsd"
        ... )
        >>>
        >>> # 快速計算
        >>> score = calculate_ppg_similarity(
        ...     "student.wav", "reference.wav",
        ...     band=50,         # 限制對齊範圍
        ...     downsample=5,    # 更多下採樣
        ...     metric="cosine"  # 更快的度量
        ... )
    """
    # 初始化 CTC 模型
    if ctc is None:
        ctc = PhoneCTC()

    # 載入音檔
    wav_a, sr_a = torchaudio.load(str(audio_a_path))
    wav_b, sr_b = torchaudio.load(str(audio_b_path))

    # 獲取音素 posteriorgrams
    logp_a, _ = ctc.posteriors_and_spans(wav_a, sr_a)
    logp_b, _ = ctc.posteriors_and_spans(wav_b, sr_b)

    # 空序列/全靜音保護
    if logp_a.size(0) < 5 or logp_b.size(0) < 5:
        return 0.0  # posteriorgram 太短，無法可靠評估

    # 計算 PPG JSD 相似度
    similarity = _ppg_jsd_similarity(
        logp_a, logp_b, metric=metric, band=band, downsample=downsample
    )

    # Clamp 到 [0, 1] 避免數值問題
    return float(max(0.0, min(1.0, similarity)))
