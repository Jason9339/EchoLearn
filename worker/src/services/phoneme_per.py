"""
PER (Phoneme Error Rate) 相似度計算
基於音素錯誤率的發音相似度評估
"""

from pathlib import Path

import torchaudio

from .phoneme_ctc import PhoneCTC


def _calc_per(ref: list[str], hyp: list[str]) -> float:
    """
    計算音素錯誤率 (Phoneme Error Rate)

    使用編輯距離 (Levenshtein Distance) 計算兩個音素序列的差異

    Args:
        ref: 參考音素序列
        hyp: 假設音素序列

    Returns:
        PER 值 [0, inf]，0 表示完全相同

    Example:
        >>> ref = ['h', 'ɛ', 'l', 'oʊ']
        >>> hyp = ['h', 'ə', 'l', 'oʊ']
        >>> per = _calc_per(ref, hyp)
        >>> print(f"PER: {per:.2f}")  # PER: 0.25 (1/4)
    """
    n, m = len(ref), len(hyp)
    if n == 0:
        return 0.0

    # 動態規劃計算編輯距離
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    return dp[n][m] / n


def calculate_per_similarity(
    audio_a_path: str | Path,
    audio_b_path: str | Path,
    ctc: PhoneCTC | None = None,
) -> float:
    """
    計算兩段語音的 PER 相似度

    基於音素錯誤率 (PER)，返回 1 - PER 作為相似度分數
    適合評估整體發音準確度，計算速度快

    Args:
        audio_a_path: 音檔 A 路徑
        audio_b_path: 音檔 B 路徑
        ctc: PhoneCTC 實例 (可選，重用以節省載入時間)

    Returns:
        相似度分數 [0, 1]
        - 1.0 表示完全相同
        - 0.0 表示完全不同
        - 可能小於 0 (當插入/刪除過多時)

    Raises:
        ImportError: 如果未安裝 transformers 套件

    Example:
        >>> from services.phoneme_per import calculate_per_similarity
        >>>
        >>> # 基本用法
        >>> score = calculate_per_similarity("student.wav", "reference.wav")
        >>> print(f"PER Similarity: {score:.4f}")
        >>>
        >>> # 批次處理 (重用 CTC 模型)
        >>> from services.phoneme_ctc import PhoneCTC
        >>> ctc = PhoneCTC()
        >>> for student_file in student_files:
        ...     score = calculate_per_similarity(student_file, "ref.wav", ctc=ctc)
        ...     print(f"{student_file}: {score:.4f}")
    """
    # 初始化 CTC 模型
    if ctc is None:
        ctc = PhoneCTC()

    # 載入音檔
    wav_a, sr_a = torchaudio.load(str(audio_a_path))
    wav_b, sr_b = torchaudio.load(str(audio_b_path))

    # 獲取音素序列
    _, spans_a = ctc.posteriors_and_spans(wav_a, sr_a)
    _, spans_b = ctc.posteriors_and_spans(wav_b, sr_b)

    phones_a = ctc.phones_from_spans(spans_a)
    phones_b = ctc.phones_from_spans(spans_b)

    # 空序列/全靜音保護
    if len(phones_a) == 0 or len(phones_b) == 0:
        return 0.0  # 無法辨識音素，視為不相似

    # 計算 PER 並轉換為相似度
    per = _calc_per(phones_a, phones_b)
    similarity = 1.0 - per

    return float(max(0.0, similarity))
