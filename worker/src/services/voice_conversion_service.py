"""
Voice Conversion Service
Handles voice conversion using FreeVC model
"""
import os
import torch
import librosa
from scipy.io.wavfile import write
import logging
from typing import Tuple, Optional

from FreeVC.models import SynthesizerTrn
from FreeVC.mel_processing import mel_spectrogram_torch
from FreeVC.wavlm import WavLM, WavLMConfig
from FreeVC.speaker_encoder.voice_encoder import SpeakerEncoder
from FreeVC import utils

logger = logging.getLogger(__name__)

# Global variables for models and configurations
net_g = None
cmodel = None
smodel = None
hps = None
device = "cpu"


def load_models(hpfile: str, ptfile: str):
    """
    Load FreeVC models (synthesizer, WavLM, speaker encoder)

    Args:
        hpfile: Path to hyperparameters config file
        ptfile: Path to model checkpoint file
    """
    global net_g, cmodel, smodel, hps

    if net_g is not None and cmodel is not None and hps is not None:
        logger.info("Models already loaded.")
        return

    logger.info(f"Loading config from {hpfile}...")
    hps = utils.get_hparams_from_file(hpfile)

    logger.info("Loading SynthesizerTrn model...")
    net_g = SynthesizerTrn(
        hps.data.filter_length // 2 + 1,
        hps.train.segment_size // hps.data.hop_length,
        **hps.model).to(device)
    _ = net_g.eval()
    logger.info(f"Loading checkpoint from {ptfile}...")
    _ = utils.load_checkpoint(ptfile, net_g, None, True)

    logger.info("Loading WavLM for content...")
    cmodel = utils.get_cmodel(0, device).to(device)

    if hps.model.use_spk:
        logger.info("Loading speaker encoder...")
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        speaker_encoder_ckpt = os.path.join(base_dir, "FreeVC/speaker_encoder/ckpt/pretrained_bak_5805000.pt")
        smodel = SpeakerEncoder(speaker_encoder_ckpt).to(device)

    logger.info("Models loaded successfully.")


def are_models_loaded() -> bool:
    """Check if all required models are loaded"""
    return net_g is not None and cmodel is not None and hps is not None


def convert_voice(source_path: str, target_path: str, output_path: str) -> str:
    """
    Convert voice from source audio to match target speaker

    Args:
        source_path: Path to source audio file (content to keep)
        target_path: Path to target audio file (voice to mimic)
        output_path: Path where converted audio will be saved

    Returns:
        Path to the converted audio file

    Raises:
        RuntimeError: If models are not loaded
        Exception: If conversion fails
    """
    if not are_models_loaded():
        raise RuntimeError("Models are not loaded. Call load_models() first.")

    try:
        # Process target audio
        wav_tgt, _ = librosa.load(target_path, sr=hps.data.sampling_rate)
        wav_tgt, _ = librosa.effects.trim(wav_tgt, top_db=20)

        g_tgt = None
        if hps.model.use_spk:
            # Extract speaker embedding
            g_tgt = smodel.embed_utterance(wav_tgt)
            g_tgt = torch.from_numpy(g_tgt).unsqueeze(0).to(device)
        else:
            # Extract mel-spectrogram
            wav_tgt = torch.from_numpy(wav_tgt).unsqueeze(0).to(device)
            mel_tgt = mel_spectrogram_torch(
                wav_tgt,
                hps.data.filter_length,
                hps.data.n_mel_channels,
                hps.data.sampling_rate,
                hps.data.hop_length,
                hps.data.win_length,
                hps.data.mel_fmin,
                hps.data.mel_fmax
            )

        # Process source audio
        wav_src, _ = librosa.load(source_path, sr=hps.data.sampling_rate)
        wav_src = torch.from_numpy(wav_src).unsqueeze(0).to(device)
        c = utils.get_content(cmodel, wav_src)

        # Perform voice conversion
        with torch.no_grad():
            if hps.model.use_spk:
                audio = net_g.infer(c, g=g_tgt)
            else:
                audio = net_g.infer(c, mel=mel_tgt)

            audio = audio[0][0].data.cpu().float().numpy()

        # Save converted audio
        write(output_path, hps.data.sampling_rate, audio)
        logger.info(f"Voice conversion successful. Output saved to {output_path}")

        return output_path

    except Exception as e:
        logger.error(f"Error during voice conversion: {e}")
        raise
