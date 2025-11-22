# routes/audio.py
"""
語音處理 API 路由 - 示範模板
這是一個基本的架構範例，供其他開發者實作語音功能時參考
"""
from flask import Blueprint, request, jsonify
from services.audio_service import transcribe_audio, analyze_pronunciation
from services.audio_scorer import AudioScorer
import tempfile
import os
import subprocess

# 創建 Blueprint
audio_bp = Blueprint('audio', __name__)


@audio_bp.route('/transcribe', methods=['POST'])
def transcribe():
    """
    語音轉文字 API

    TODO: 實作語音轉文字功能
    建議使用: OpenAI Whisper API

    Request:
        - file: 音訊檔案 (multipart/form-data)
        - language: 語言代碼 (可選)

    Response:
        {
            "success": true,
            "text": "轉錄的文字內容"
        }
    """
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400

        file = request.files['file']
        language = request.form.get('language', 'en')

        # TODO: 儲存上傳的檔案
        # file_path = save_file(file)

        # 呼叫 service 層處理
        # result = transcribe_audio(file_path, language)

        # 目前返回示範回應
        result = transcribe_audio('', language)

        return jsonify({
            "success": True,
            "text": result['text'],
            "confidence": result.get('confidence', 0)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@audio_bp.route('/pronunciation', methods=['POST'])
def pronunciation():
    """
    發音評分 API

    TODO: 實作發音分析與評分功能
    建議使用: Azure Speech Service Pronunciation Assessment

    Request:
        - file: 音訊檔案
        - reference_text: 參考文本
        - language: 語言代碼

    Response:
        {
            "success": true,
            "score": 85,
            "feedback": {...}
        }
    """
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400

        file = request.files['file']
        reference_text = request.form.get('reference_text', '')
        language = request.form.get('language', 'en')

        if not reference_text:
            return jsonify({"success": False, "error": "Reference text is required"}), 400

        # TODO: 儲存上傳的檔案
        # file_path = save_file(file)

        # 呼叫 service 層處理
        # result = analyze_pronunciation(file_path, reference_text, language)

        # 目前返回示範回應
        result = analyze_pronunciation('', reference_text, language)

        return jsonify({
            "success": True,
            "score": result['score'],
            "feedback": result['feedback']
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@audio_bp.route('/health', methods=['GET'])
def health_check():
    """健康檢查 API"""
    return jsonify({
        "success": True,
        "service": "audio-processing",
        "status": "ready for implementation"
    })


@audio_bp.route('/score', methods=['POST'])
def score_audio():
    """
    接收參考音檔與測試音檔，並回傳所有評分指標

    Request:
        - reference_audio: 參考音訊檔案 (multipart/form-data)
        - test_audio: 要評分的音訊檔案 (multipart/form-data)

    Response:
        {
            "success": true,
            "scores": {
                'PER': float,
                'PPG': float,
                'GOP': float,
                'GPE_offset': float,
                'FFE': float,
                'WER': float,
                'Energy': float,
                'VDE': float
            }
        }
    """
    try:
        reference_audio = request.files.get('reference_audio')
        test_audio = request.files.get('test_audio')

        if not reference_audio or not test_audio:
            return jsonify({"success": False, "error": "Missing files"}), 400

        # === 將兩個音檔存到暫存檔 ===
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as ref_tmp:
            ref_path = ref_tmp.name
            reference_audio.save(ref_path)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as test_tmp:
            test_path = test_tmp.name
            test_audio.save(test_path)

        # === 如果上傳的是 webm 格式，轉成 wav 格式 ===
        wav_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        wav_path = wav_tmp.name
        wav_tmp.close()

        # ffmpeg 轉檔
        subprocess.run([
            "ffmpeg", "-y", "-i", test_path, wav_path
        ], check=True)

        # === 呼叫你的 AudioScorer（它需要檔案路徑，不是 ndarray）===
        scorer = AudioScorer()
        scores = scorer.score(ref_path, wav_path)

        return jsonify({
            "success": True,
            "scores": scores
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        # 無論成功失敗都刪掉暫存檔
        try:
            os.remove(ref_path)
            os.remove(test_path)
            os.remove(wav_path)
        except Exception:
            pass