"""
音素 CTC 辨識模組
使用 wav2vec2 進行音素級別的語音辨識
"""

import torch
import torchaudio
from torch.nn import functional as F

# Optional dependencies
try:
    from transformers import (
        AutoFeatureExtractor,
        AutoModelForCTC,
        AutoProcessor,
        AutoTokenizer,
        Wav2Vec2Processor,
    )

    HAS_TRANSFORMERS = True
except ImportError:
    AutoFeatureExtractor = AutoModelForCTC = AutoProcessor = AutoTokenizer = None
    Wav2Vec2Processor = None
    HAS_TRANSFORMERS = False


class PhoneCTC:
    """
    音素級別的 CTC 模型包裝器
    使用 wav2vec2 + phoneme CTC 進行音素辨識

    Example:
        >>> from services.phoneme_ctc import PhoneCTC
        >>> import torchaudio
        >>>
        >>> ctc = PhoneCTC()
        >>> wav, sr = torchaudio.load("audio.wav")
        >>> logp, spans = ctc.posteriors_and_spans(wav, sr)
        >>> phones = ctc.phones_from_spans(spans)
        >>> print(phones)  # ['h', 'ɛ', 'l', 'oʊ']
    """

    def __init__(
        self,
        model_name: str = "facebook/wav2vec2-lv-60-espeak-cv-ft",
        device: torch.device | None = None,
    ) -> None:
        """
        初始化音素 CTC 模型

        Args:
            model_name: HuggingFace 模型名稱 (預設使用 wav2vec2 + eSpeak phonemes)
            device: 計算裝置 (None = 自動選擇 GPU/CPU)

        Raises:
            ImportError: 如果未安裝 transformers 套件
        """
        if not HAS_TRANSFORMERS:
            raise ImportError(
                "transformers library required for PhoneCTC. "
                "Install with: pip install transformers"
            )

        self.processor = self._load_processor(model_name)
        self.model = AutoModelForCTC.from_pretrained(model_name).eval()
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.sr = self.processor.feature_extractor.sampling_rate

        # 嚴謹取得 blank token ID (多重 fallback)
        self.blank = getattr(self.processor.tokenizer, "pad_token_id", None)
        if self.blank is None:
            self.blank = getattr(self.model.config, "pad_token_id", None)
        if self.blank is None or self.blank < 0:
            # 有些模型 blank_id 設為 0
            self.blank = getattr(self.model.config, "blank_token_id", 0)

        self.id2tok = {i: t for t, i in self.processor.tokenizer.get_vocab().items()}

    def _load_processor(self, model_name: str):
        """
        Instantiate the processor with robust fallbacks.

        Some transformer releases return an invalid boolean tokenizer entry for
        this model. We first try the default AutoProcessor path and, on failure,
        manually compose a Wav2Vec2Processor from its components.
        """
        last_error: Exception | None = None

        if AutoProcessor is not None:
            try:
                return AutoProcessor.from_pretrained(model_name, use_fast=False)
            except (TypeError, ValueError) as err:
                # e.g. "Received a bool for argument tokenizer..."
                last_error = err
            except OSError as err:
                last_error = err

        if any(obj is None for obj in (AutoFeatureExtractor, AutoTokenizer, Wav2Vec2Processor)):
            # transformers is missing or incomplete; surface the previous error if we have one
            if last_error is not None:
                raise last_error
            raise ImportError("transformers installation missing processor components")

        feature_extractor = AutoFeatureExtractor.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)

        return Wav2Vec2Processor(feature_extractor=feature_extractor, tokenizer=tokenizer)

    @torch.inference_mode()
    def posteriors_and_spans(
        self, wav: torch.Tensor, sr: int
    ) -> tuple[torch.Tensor, list[tuple[int, int, int]]]:
        """
        計算音素後驗機率和音素片段

        Args:
            wav: 音訊波形 [1, T] 或 [T]
            sr: 採樣率

        Returns:
            logp: Log-posteriorgram [T, V]，每個時間步的音素機率分佈
            spans: List of (phoneme_id, start_frame, end_frame)，音素片段列表

        Example:
            >>> wav, sr = torchaudio.load("hello.wav")
            >>> logp, spans = ctc.posteriors_and_spans(wav, sr)
            >>> # spans: [(5, 10, 15), (23, 16, 22), ...]
            >>> #          (音素ID, 起始幀, 結束幀)
        """
        # 確保單聲道
        if wav.dim() == 2:
            wav = wav.mean(0, keepdim=True)

        # 重採樣到模型要求的採樣率
        if sr != self.sr:
            wav = torchaudio.functional.resample(wav, sr, self.sr)

        # 提取特徵並計算 logits
        inp = self.processor(
            wav.squeeze(0).cpu().numpy(), sampling_rate=self.sr, return_tensors="pt"
        )
        logits = self.model(inp.input_values.to(self.device)).logits.squeeze(0)
        logp = F.log_softmax(logits, dim=-1).cpu()  # [T, V]

        # CTC 解碼：移除 blank 和重複
        ids = torch.argmax(logp, dim=-1).tolist()
        spans: list[tuple[int, int, int]] = []
        collapsed: list[int] = []
        prev = None

        for pid in ids:
            if pid == self.blank:
                prev = pid
                continue
            if pid != prev:
                collapsed.append(pid)
            prev = pid

        # 找出每個音素的 span
        if collapsed:
            j = 0
            cur = collapsed[0]
            start = None
            for t, pid in enumerate(ids):
                if pid == self.blank:
                    continue
                if start is None and pid == cur:
                    start = t
                    last = t
                elif start is not None and pid == cur:
                    last = t
                elif start is not None and pid != cur:
                    spans.append((cur, start, last))
                    j += 1
                    if j >= len(collapsed):
                        break
                    cur = collapsed[j]
                    start = t
                    last = t

            # 處理最後一個音素
            if start is not None and j < len(collapsed):
                spans.append((cur, start, last))

        return logp, spans

    def phones_from_spans(self, spans: list[tuple[int, int, int]]) -> list[str]:
        """
        從 spans 提取音素符號列表

        Args:
            spans: List of (phoneme_id, start_frame, end_frame)

        Returns:
            音素符號列表，例如 ['h', 'ɛ', 'l', 'oʊ']

        Example:
            >>> _, spans = ctc.posteriors_and_spans(wav, sr)
            >>> phones = ctc.phones_from_spans(spans)
            >>> print(' '.join(phones))  # 'h ɛ l oʊ'
        """
        return [self.id2tok.get(int(pid), "") for pid, _, _ in spans]
