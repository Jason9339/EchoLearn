import hashlib
import math
import os
import string
import time
from pathlib import Path
from typing import Optional, Tuple, Union

_WORKER_ROOT = Path(__file__).resolve().parents[2]
_CACHE_HOME = _WORKER_ROOT / "temp" / "cache"
_WHISPER_CACHE_DIR = _CACHE_HOME / "whisper"
os.environ.setdefault("XDG_CACHE_HOME", str(_CACHE_HOME))
os.environ.setdefault("WHISPER_CACHE_DIR", str(_WHISPER_CACHE_DIR))
_WHISPER_CACHE_DIR.mkdir(parents=True, exist_ok=True)

import numpy as np
import torch
import torchaudio
import whisper
from torch.nn import functional as F

from services.preprocessing import preprocess_pipeline

PathLike = Union[str, Path]

#########################################################
#- To preprocess audio, call read_or_create_preprocessed_audio(source_path, cache_dir)
# - To calculate WER, call get_wer_score(test_audio_path, ground_truth_audio_path)
# - To calculate GOP, call get_gop_score(test_audio_path, ground_truth_audio_path)
#########################################################


##### helpers for WER #####
def _normalize_text(text: str) -> str:
    lowered = text.lower()
    without_punct = lowered.translate(str.maketrans("", "", string.punctuation))
    return " ".join(without_punct.split())


def cal_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    if not ref_words:
        return 0.0

    ref_len = len(ref_words)
    hyp_len = len(hyp_words)

    # Initialize edit distance matrix for dynamic programming comparison
    distances = [[0] * (hyp_len + 1) for _ in range(ref_len + 1)]
    for i in range(ref_len + 1):
        distances[i][0] = i
    for j in range(hyp_len + 1):
        distances[0][j] = j

    for i in range(1, ref_len + 1):
        for j in range(1, hyp_len + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                distances[i][j] = distances[i - 1][j - 1]
            else:
                substitution = distances[i - 1][j - 1]
                insertion = distances[i][j - 1]
                deletion = distances[i - 1][j]
                distances[i][j] = 1 + min(substitution, insertion, deletion)

    return distances[ref_len][hyp_len] / ref_len


def get_wer_score(
    test_audio_path: PathLike,
    ground_truth_audio_path: PathLike,
    *,
    gt_transcript: bool = False,
    ground_truth_transcript_path: Optional[PathLike] = None,
    return_transcripts: bool = False,
) -> Union[float, Tuple[float, str, str]]:
    """Return WER using test audio and either ground-truth audio or a provided transcript."""

    test_path = Path(test_audio_path)
    gt_path = Path(ground_truth_audio_path)

    # Validate that both audio files exist before processing
    if not test_path.is_file():
        raise ValueError(f"Test audio not found: {test_path}")
    if not gt_transcript and not gt_path.is_file():
        raise ValueError(f"Ground truth audio not found: {gt_path}")

    # Use Whisper to transcribe both recordings with the same model instance
    model = whisper.load_model("base", device="cpu")

    test_result = model.transcribe(str(test_path), fp16=False)
    test_text_raw = test_result["text"].strip()
    # Normalize transcripts to emphasize lexical differences only
    test_text = _normalize_text(test_text_raw)

    if gt_transcript:
        # Load ground truth text from the provided transcript file instead of transcribing audio
        if ground_truth_transcript_path is None:
            raise ValueError("ground_truth_transcript_path must be provided when gt_transcript is True")
        transcript_path = Path(ground_truth_transcript_path)
        if not transcript_path.is_file():
            raise ValueError(f"Ground truth transcript not found: {transcript_path}")
        gt_text_raw = transcript_path.read_text(encoding="utf-8").strip()
    else:
        # Transcribe the reference audio when no external transcript is supplied
        gt_result = model.transcribe(str(gt_path), fp16=False)
        gt_text_raw = gt_result["text"].strip()

    gt_text = _normalize_text(gt_text_raw)

    # print(f"Test text: {test_text}")
    # print(f"Ground truth text: {gt_text}")

    # Return WER between predicted and reference text
    wer = cal_wer(gt_text, test_text)
    wer_value = float(f"{wer:.4f}")
    if return_transcripts:
        return wer_value, test_text_raw, gt_text_raw
    return wer_value


##### helpers for GOP #####
def _load_audio(path: Path, target_sample_rate: int) -> torch.Tensor:
    """Load a wav file, convert to mono, and resample to the target rate."""

    # Read waveform, fold to mono, and resample when needed
    waveform, sample_rate = torchaudio.load(path)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != target_sample_rate:
        waveform = torchaudio.functional.resample(waveform, sample_rate, target_sample_rate)
    return waveform


class _PPGExtractor:
    """Wrapper that turns audio waveforms into posteriorgrams."""

    def __init__(self, device: torch.device) -> None:
        # Initialize wav2vec2 bundle once per device for reuse
        self.bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        self.sample_rate = self.bundle.sample_rate
        self.model = self.bundle.get_model().to(device)
        self.model.eval()
        self.device = device

    def __call__(self, waveform: torch.Tensor) -> torch.Tensor:
        waveform = waveform.to(self.device)
        # Forward pass generates frame-level posterior probabilities
        with torch.inference_mode():
            outputs = self.model(waveform)
        emission = outputs[0] if isinstance(outputs, tuple) else outputs
        emission = emission.squeeze(0)
        log_probs = F.log_softmax(emission, dim=-1)
        return log_probs.cpu()


_PPG_EXTRACTORS: dict[str, _PPGExtractor] = {}


def _get_ppg_extractor(device: torch.device) -> _PPGExtractor:
    key = str(device)
    extractor = _PPG_EXTRACTORS.get(key)
    if extractor is None:
        # Create and memoize extractor keyed by device string
        extractor = _PPGExtractor(device)
        _PPG_EXTRACTORS[key] = extractor
    return extractor


def _align_ppgs(ppg_test: torch.Tensor, ppg_ref: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    num_test = ppg_test.size(0)
    num_ref = ppg_ref.size(0)
    if num_test == 0 or num_ref == 0:
        empty = ppg_test.new_zeros((0, ppg_test.size(-1)))
        return empty, empty

    # Measure frame similarity and convert to a distance matrix for DTW
    similarity = F.cosine_similarity(
        ppg_test.unsqueeze(1),
        ppg_ref.unsqueeze(0),
        dim=-1,
    ).clamp(min=-1.0, max=1.0)
    distance = (1.0 - similarity).cpu().numpy()

    acc_cost = np.full((num_test + 1, num_ref + 1), np.inf, dtype=np.float32)
    acc_cost[0, 0] = 0.0
    for i in range(1, num_test + 1):
        for j in range(1, num_ref + 1):
            step_cost = distance[i - 1, j - 1]
            acc_cost[i, j] = step_cost + min(
                acc_cost[i - 1, j],
                acc_cost[i, j - 1],
                acc_cost[i - 1, j - 1],
            )

    # Trace the lowest-cost path through the matrix to align indices
    i, j = num_test, num_ref
    path_test: list[int] = []
    path_ref: list[int] = []
    while i > 0 and j > 0:
        path_test.append(i - 1)
        path_ref.append(j - 1)
        prev_choices = (
            acc_cost[i - 1, j],
            acc_cost[i, j - 1],
            acc_cost[i - 1, j - 1],
        )
        move = int(np.argmin(prev_choices))
        if move == 0:
            i -= 1
        elif move == 1:
            j -= 1
        else:
            i -= 1
            j -= 1

    while i > 0:
        path_test.append(i - 1)
        path_ref.append(0)
        i -= 1
    while j > 0:
        path_test.append(0)
        path_ref.append(j - 1)
        j -= 1

    path_test.reverse()
    path_ref.reverse()

    index_test = torch.tensor(path_test, dtype=torch.long, device=ppg_test.device)
    index_ref = torch.tensor(path_ref, dtype=torch.long, device=ppg_ref.device)

    aligned_test = ppg_test.index_select(0, index_test)
    aligned_ref = ppg_ref.index_select(0, index_ref)
    return aligned_test, aligned_ref


def _compute_jsd_similarity(ppg_test: torch.Tensor, ppg_ref: torch.Tensor) -> float:
    log_p = ppg_test
    log_q = ppg_ref

    # Compute Jensen-Shannon divergence between posterior distributions
    log_m = torch.logsumexp(torch.stack((log_p, log_q)), dim=0) - math.log(2.0)

    kl_pm = torch.exp(log_p) * (log_p - log_m)
    kl_pm = kl_pm.sum(dim=-1)

    kl_qm = torch.exp(log_q) * (log_q - log_m)
    kl_qm = kl_qm.sum(dim=-1)
    js_divergence = 0.5 * (kl_pm + kl_qm)

    mean_jsd = js_divergence.mean()
    normalized = 1.0 - (mean_jsd / math.log(2.0))
    similarity = torch.clamp(normalized, min=0.0, max=1.0)
    return float(similarity.item())


def get_gop_score(test_audio_path: str, ground_truth_audio_path: str, alignment: bool = True) -> float:
    """Compute the GOP score between two audio files."""

    test_path = Path(test_audio_path)
    gt_path = Path(ground_truth_audio_path)

    # Make sure both input files are available before heavy processing
    if not test_path.is_file():
        raise ValueError(f"Test audio not found: {test_path}")
    if not gt_path.is_file():
        raise ValueError(f"Ground truth audio not found: {gt_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    extractor = _get_ppg_extractor(device)
    sample_rate = extractor.sample_rate

    test_waveform = _load_audio(test_path, sample_rate)
    gt_waveform = _load_audio(gt_path, sample_rate)

    test_ppg = extractor(test_waveform)
    gt_ppg = extractor(gt_waveform)

    if alignment:
        # Align posteriorgrams before comparing distributions
        aligned_test, aligned_ref = _align_ppgs(test_ppg, gt_ppg)
        if aligned_test.size(0) == 0:
            return 0.0
        gop_score = _compute_jsd_similarity(aligned_test, aligned_ref)
    else:
        # Compare only the overlapping portion when alignment is skipped
        if test_ppg.size(0) == 0 or gt_ppg.size(0) == 0:
            return 0.0
        min_len = min(test_ppg.size(0), gt_ppg.size(0))
        trimmed_test = test_ppg[:min_len]
        trimmed_ref = gt_ppg[:min_len]
        gop_score = _compute_jsd_similarity(trimmed_test, trimmed_ref)

    return float(f"{gop_score:.4f}")


##### helpers for audio preprocessing #####
def preprocess_audio(
    input_path: PathLike,
    output_path: PathLike,
    sample_rate: int = 16000,
    silence_threshold: int = -40,
    target_peak_dbfs: float = -3.0,
    target_lufs: float = -16.0,
    use_deepfilter: bool = True,
) -> float:
    """Run the shared preprocessing pipeline and report elapsed time."""

    start_time = time.time()
    # `silence_threshold` is kept for backward compatibility; trimming is handled inside the pipeline.
    _ = silence_threshold

    preprocess_pipeline(
        src_path=input_path,
        out_path=output_path,
        target_sr=sample_rate,
        target_peak_dbfs=target_peak_dbfs,
        target_lufs=target_lufs,
        use_deepfilter=use_deepfilter,
    )

    return float(f"{time.time() - start_time:.2f}")


def read_or_create_preprocessed_audio(
    source_path: PathLike,
    cache_dir: PathLike,
    sample_rate: int = 16000,
    silence_threshold: int = -40,
) -> Path:
    """Return the cached cleaned wav path for `source_path`, creating it if needed."""

    source = Path(source_path)
    # Fail early if the source audio cannot be located
    if not source.is_file():
        raise FileNotFoundError(f"Audio not found: {source}")

    cache_root = Path(cache_dir)
    cache_root.mkdir(parents=True, exist_ok=True)

    # Use a stable fingerprint of the source path to name cache entries
    fingerprint = hashlib.sha1(str(source.resolve()).encode("utf-8")).hexdigest()[:10]
    candidate = cache_root / f"{source.stem}__{fingerprint}.wav"

    if not candidate.exists():
        # Generate the cleaned version once so future calls reuse it.
        preprocess_audio(
            input_path=source,
            output_path=candidate,
            sample_rate=sample_rate,
            silence_threshold=silence_threshold,
        )

    return candidate
