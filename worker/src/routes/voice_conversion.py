"""
Voice Conversion API Routes
Handles HTTP requests for voice conversion using FreeVC
"""
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
import shutil
import logging

from services.voice_conversion_service import load_models, are_models_loaded, convert_voice

voice_conversion_bp = Blueprint('voice_conversion', __name__)

logger = logging.getLogger(__name__)


@voice_conversion_bp.route("/convert", methods=["POST"])
def voice_convert():
    """
    Voice Conversion API Endpoint

    Converts the voice from source audio to match the target speaker's voice.

    Request (multipart/form-data):
        - source_audio: Source audio file (content to preserve)
        - target_audio: Target audio file (voice to mimic)

    Response:
        - Converted audio file (.wav)
    """
    # Check if models are loaded
    if not are_models_loaded():
        try:
            # Attempt to load models if not already loaded
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_dir, "FreeVC/configs/freevc.json")
            checkpoint_path = os.path.join(base_dir, "FreeVC/checkpoints/freevc.pth")
            load_models(config_path, checkpoint_path)
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return jsonify({"error": "Models failed to load."}), 500

    # Validate request
    if 'source_audio' not in request.files or 'target_audio' not in request.files:
        return jsonify({"error": "Missing audio files"}), 400

    source_audio_file = request.files['source_audio']
    target_audio_file = request.files['target_audio']

    if source_audio_file.filename == '' or target_audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Create temporary directory for processing
    temp_dir = os.path.join(current_app.root_path, f"temp_audio_{uuid.uuid4()}")
    os.makedirs(temp_dir, exist_ok=True)

    source_filename = secure_filename(source_audio_file.filename)
    target_filename = secure_filename(target_audio_file.filename)

    source_path = os.path.join(temp_dir, source_filename)
    target_path = os.path.join(temp_dir, target_filename)
    output_filename = f"converted_{uuid.uuid4()}.wav"
    output_path = os.path.join(temp_dir, output_filename)

    try:
        # Save uploaded files
        source_audio_file.save(source_path)
        target_audio_file.save(target_path)

        # Perform voice conversion using service layer
        convert_voice(source_path, target_path, output_path)

        # Read converted file and return
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
