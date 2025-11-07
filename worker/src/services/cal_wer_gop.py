import hashlib
import math
import string
import time
from io import BytesIO
from pathlib import Path

import librosa
import noisereduce as nr
import numpy as np
import soundfile as sf
import torch
import torchaudio
import whisper
from pydub import AudioSegment, effects, silence
from torch.nn import functional as F
from tqdm import tqdm

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
    test_audio_path: str,
    ground_truth_audio_path: str,
    *,
    gt_transcript: bool = False,
    ground_truth_transcript_path: str | Path | None = None,
) -> float:
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

    # Normalize transcripts to emphasize lexical differences only
    test_text = _normalize_text(test_result["text"].strip())

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
    return float(f"{wer:.4f}")


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
    input_path: str | Path,
    output_path: str | Path,
    sample_rate: int = 16000,
    silence_threshold: int = -40,
) -> float:
    """Denoise, normalize, trim silence, and export a cleaned wav file."""

    start_time = time.time()
    input_path = Path(input_path)
    output_path = Path(output_path)

    steps = 5
    with tqdm(total=steps, desc="Preprocessing audio", unit="step") as progress:
        # Load waveform as mono at the target sample rate
        audio, sr = librosa.load(input_path, sr=sample_rate, mono=True)
        progress.update()

        # Estimate noise profile and perform stationary noise reduction
        noise_sample = audio[:sr] if audio.size > sr else audio
        reduced = nr.reduce_noise(
            y=audio,
            sr=sr,
            prop_decrease=1.0,
            stationary=True,
            n_std_thresh_stationary=1.3,
            y_noise=noise_sample if noise_sample.size > 0 else None,
        )
        progress.update()

        # Restore loudness lost during noise reduction and add a controlled boost
        eps = 1e-8
        original_rms = float(np.sqrt(np.mean(audio**2)) + eps)
        reduced_rms = float(np.sqrt(np.mean(reduced**2)) + eps)
        target_rms = original_rms * 1.3
        gain_factor = min(target_rms / reduced_rms, 5.0)
        boosted = np.clip(reduced * gain_factor, -1.0, 1.0)

        # Normalize and balance dynamics using pydub
        buffer = BytesIO()
        sf.write(buffer, boosted, sr, format="WAV")
        buffer.seek(0)
        normalized_audio = effects.normalize(AudioSegment.from_file(buffer, format="wav"))
        balanced_audio = effects.compress_dynamic_range(
            normalized_audio,
            threshold=-30.0,
            ratio=6.0,
            attack=5,
            release=50,
        )
        progress.update()

        # Trim leading and trailing silence based on the threshold
        leading = silence.detect_leading_silence(balanced_audio, silence_threshold=silence_threshold)
        trailing = silence.detect_leading_silence(
            balanced_audio.reverse(), silence_threshold=silence_threshold
        )
        trimmed = balanced_audio[leading:] if trailing == 0 else balanced_audio[leading:-trailing]
        progress.update()

        # Apply a final gain toward a consistent target loudness without clipping
        target_dbfs = -9.0
        max_gain_db = 12.0
        current_dbfs = trimmed.dBFS if trimmed.dBFS != float("-inf") else -60.0
        gain_needed = min(target_dbfs - current_dbfs, max_gain_db)
        loud_output = trimmed.apply_gain(gain_needed)

        # Export the cleaned audio to the requested output path
        loud_output.export(output_path, format="wav")
        progress.update()

    return float(f"{time.time() - start_time:.2f}")


def read_or_create_preprocessed_audio(
    source_path: str | Path,
    cache_dir: str | Path,
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