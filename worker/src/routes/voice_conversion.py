from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import torch
import librosa
from scipy.io.wavfile import write
import uuid
import shutil
import logging

from FreeVC.models import SynthesizerTrn
from FreeVC.mel_processing import mel_spectrogram_torch
from FreeVC.wavlm import WavLM, WavLMConfig
from FreeVC.speaker_encoder.voice_encoder import SpeakerEncoder
from FreeVC import utils

voice_conversion_bp = Blueprint('voice_conversion', __name__)

# Global variables for models and configurations
net_g = None
cmodel = None
smodel = None
hps = None
device = "cpu"

# Placeholder for checkpoints directory
CHECKPOINTS_DIR = "src/FreeVC/checkpoints"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_models(hpfile: str, ptfile: str):
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
    cmodel = utils.get_cmodel(0, device).to(device) # Assuming 0 is the default for WavLM

    if hps.model.use_spk:
        logger.info("Loading speaker encoder...")
        # Ensure the speaker encoder checkpoint path is correct
        speaker_encoder_ckpt = "src/FreeVC/speaker_encoder/ckpt/pretrained_bak_5805000.pt" # Adjust path as needed
        smodel = SpeakerEncoder(speaker_encoder_ckpt).to(device)
    
    logger.info("Models loaded successfully.")

@voice_conversion_bp.route("/convert", methods=["POST"])
def voice_convert():
    if net_g is None or cmodel is None or hps is None:
        # Attempt to load models if not already loaded (e.g., during development server reload)
        try:
            load_models("src/FreeVC/configs/freevc.json", "src/FreeVC/checkpoints/freevc.pth")
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return jsonify({"error": "Models failed to load."}), 500

    if 'source_audio' not in request.files or 'target_audio' not in request.files:
        return jsonify({"error": "Missing audio files"}), 400

    source_audio_file = request.files['source_audio']
    target_audio_file = request.files['target_audio']

    if source_audio_file.filename == '' or target_audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Create a temporary directory to save uploaded files
    temp_dir = os.path.join(current_app.root_path, f"temp_audio_{uuid.uuid4()}")
    os.makedirs(temp_dir, exist_ok=True)
    
    source_filename = secure_filename(source_audio_file.filename)
    target_filename = secure_filename(target_audio_file.filename)

    source_path = os.path.join(temp_dir, source_filename)
    target_path = os.path.join(temp_dir, target_filename)

    try:
        source_audio_file.save(source_path)
        target_audio_file.save(target_path)

        # Process target audio
        wav_tgt, _ = librosa.load(target_path, sr=hps.data.sampling_rate)
        wav_tgt, _ = librosa.effects.trim(wav_tgt, top_db=20)
        
        g_tgt = None
        if hps.model.use_spk:
            g_tgt = smodel.embed_utterance(wav_tgt)
            g_tgt = torch.from_numpy(g_tgt).unsqueeze(0).to(device)
        else:
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
        
        with torch.no_grad():
            if hps.model.use_spk:
                audio = net_g.infer(c, g=g_tgt)
            else:
                audio = net_g.infer(c, mel=mel_tgt)
            
            audio = audio[0][0].data.cpu().float().numpy()

        output_filename = f"converted_{uuid.uuid4()}.wav"
        output_path = os.path.join(temp_dir, output_filename)
        write(output_path, hps.data.sampling_rate, audio)

        # Return the converted audio file
        return_data = None
        with open(output_path, 'rb') as f:
            return_data = f.read()

        response = current_app.make_response(return_data)
        response.headers['Content-Type'] = 'audio/wav'
        response.headers['Content-Disposition'] = f'attachment; filename={output_filename}'
        return response

    except Exception as e:
        logger.error(f"Error during voice conversion: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temporary files
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
