"""
統一的音訊評分介面
整合所有語音評估指標，提供單一入口點
"""

from typing import Dict, Union
from pathlib import Path
import torch
import torchaudio

from services.phoneme_ctc import PhoneCTC
from services.speech_metrics import SpeechMetrics
from services.cal_wer_gop import get_wer_score
from services.predictor import RatingPredictor


class AudioScorer:
    """
    統一的音訊評分器

    使用方法:
        >>> scorer = AudioScorer()
        >>> scores = scorer.score(reference_audio, test_audio)
        >>> print(scores)
        {
            'PER': 0.95,
            'PPG': 0.92,
            'GOP': 0.88,
            'GPE_offset': 0.91,
            'FFE': 0.89,
            'WER': 0.85,
            'Energy': 0.87,
            'VDE': 0.93
        }
    """

    def __init__(
        self,
        phoneme_model: str = "facebook/wav2vec2-lv-60-espeak-cv-ft",
        device: torch.device = None
    ):
        """
        初始化評分器

        Args:
            phoneme_model: 音素模型名稱
            device: 計算裝置 (None = 自動選擇)
        """
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # 初始化各個評估模組
        print("初始化 PhoneCTC...")
        self.ctc = PhoneCTC(model_name=phoneme_model, device=self.device)

        print("初始化 SpeechMetrics...")
        self.speech_metrics = SpeechMetrics()

        print("初始化 RatingPredictor...")
        self.rating_predictor = RatingPredictor()

        print("✅ AudioScorer 初始化完成")

    def score(
        self,
        reference_audio: Union[str, Path],
        test_audio: Union[str, Path]
    ) -> float:
        """
        計算模型預測評分 (只計算必要的三個指標)

        Args:
            reference_audio: 參考音檔路徑
            test_audio: 要評分的音檔路徑

        Returns:
            float: 模型預測的人類評分 (1-5 分)
        """
        ref_path = str(reference_audio)
        test_path = str(test_audio)

        scores = {}

        # === 只計算模型需要的三個指標 ===

        # 1. PhoneCTC 相關指標 (PER, PPG)
        ref_wav, ref_sr = torchaudio.load(ref_path)
        test_wav, test_sr = torchaudio.load(test_path)

        # 計算後驗機率和音素片段
        ref_logp, ref_spans = self.ctc.posteriors_and_spans(ref_wav, ref_sr)
        test_logp, test_spans = self.ctc.posteriors_and_spans(test_wav, test_sr)

        ref_phones = self.ctc.phones_from_spans(ref_spans)
        test_phones = self.ctc.phones_from_spans(test_spans)

        # PER 相似度 (1 - 音素錯誤率)
        scores['PER'] = self._calculate_per_similarity(ref_phones, test_phones)

        # PPG 相似度
        scores['PPG'] = self._calculate_ppg_similarity(ref_logp, test_logp)

        # 2. Energy 相似度
        scores['Energy'] = self.speech_metrics.calculate_energy_similarity(ref_path, test_path)

        # === 使用模型預測人類評分 (1-5 分) ===
        model_features = {
            'score_PER': scores['PER'],
            'score_PPG': scores['PPG'],
            'score_Energy': scores['Energy']
        }
        rating = self.rating_predictor.predict(model_features)

        return rating

    def _calculate_per_similarity(self, ref_phones: list, test_phones: list) -> float:
        """
        計算 PER 相似度 (1 - 音素錯誤率)
        使用 Levenshtein 距離計算
        """
        if not ref_phones:
            return 0.0

        # Levenshtein 距離計算
        m, n = len(ref_phones), len(test_phones)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if ref_phones[i - 1] == test_phones[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

        edit_distance = dp[m][n]
        per = edit_distance / len(ref_phones)

        # 轉換為相似度
        return max(0.0, 1.0 - per)

    def _calculate_ppg_similarity(
        self,
        ref_logp: torch.Tensor,
        test_logp: torch.Tensor
    ) -> float:
        """
        計算 PPG 相似度
        使用 cosine similarity
        """
        # 取平均後驗作為整體表示
        ref_mean = ref_logp.exp().mean(dim=0)  # [V]
        test_mean = test_logp.exp().mean(dim=0)  # [V]

        # Cosine similarity
        cos_sim = torch.nn.functional.cosine_similarity(
            ref_mean.unsqueeze(0),
            test_mean.unsqueeze(0)
        )

        # 轉換到 [0, 1]
        similarity = (cos_sim.item() + 1.0) / 2.0

        return float(similarity)

    def _calculate_gop(
        self,
        ref_logp: torch.Tensor,
        ref_spans: list,
        test_logp: torch.Tensor,
        test_spans: list
    ) -> float:
        """
        計算 GOP-new (Goodness of Pronunciation)
        基於音素片段的平均對數機率
        """
        if not test_spans:
            return 0.0

        # 計算測試音檔每個音素片段的平均對數機率
        gop_scores = []
        for pid, start, end in test_spans:
            # 取該音素在其時間片段內的平均機率
            segment_logp = test_logp[start:end+1, pid]
            avg_logp = segment_logp.mean().item()
            gop_scores.append(avg_logp)

        if not gop_scores:
            return 0.0

        # 平均 GOP 分數，並轉換到 [0, 1]
        # log probability 範圍約 [-10, 0]，我們做簡單的線性轉換
        mean_gop = sum(gop_scores) / len(gop_scores)

        # 轉換: -10 -> 0, 0 -> 1
        normalized_gop = max(0.0, min(1.0, (mean_gop + 10.0) / 10.0))

        return float(normalized_gop)
