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


@audio_bp.route('/scores', methods=['GET'])
def get_scores():
    """
    批次取得某個課程的所有評分

    Query Parameters:
        - user_id: 使用者 ID
        - course_id: 課程 ID

    Response:
        {
            "success": true,
            "scores": {
                "1": {  // sentence_id
                    "0": 4.5,  // slot_index: score
                    "1": 3.8,
                    ...
                },
                ...
            }
        }
    """
    try:
        from services.supabase_client import get_supabase_client

        user_id = request.args.get('user_id')
        course_id = request.args.get('course_id')

        if not user_id or not course_id:
            return jsonify({
                "success": False,
                "error": "Missing user_id or course_id"
            }), 400

        print(f"\n{'='*60}")
        print(f"📥 收到評分查詢請求")
        print(f"{'='*60}")
        print(f"user_id: {user_id}")
        print(f"course_id: {course_id}")
        print(f"{'='*60}\n")

        supabase = get_supabase_client()
        scores_list = supabase.get_ai_scores_by_course(
            user_id=user_id,
            course_id=course_id
        )

        # 轉換為前端需要的格式：{sentence_id: {slot_index: score}}
        scores_dict = {}
        for item in scores_list:
            sentence_id = str(item['sentence_id'])
            slot_index = str(item['slot_index'])
            score = float(item['score'])

            if sentence_id not in scores_dict:
                scores_dict[sentence_id] = {}

            scores_dict[sentence_id][slot_index] = score

        print(f"✅ 找到 {len(scores_list)} 個評分")

        return jsonify({
            "success": True,
            "scores": scores_dict
        })

    except Exception as e:
        print(f"❌ 獲取評分失敗: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@audio_bp.route('/score', methods=['DELETE'])
def delete_score():
    """
    刪除 AI 評分記錄（當使用者重新錄製時）

    Request Body (JSON):
        {
            "user_id": "uuid",
            "course_id": "string",
            "sentence_id": int,
            "slot_index": int
        }

    Response:
        {
            "success": true
        }
    """
    try:
        from services.supabase_client import get_supabase_client

        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "Missing request body"
            }), 400

        user_id = data.get('user_id')
        course_id = data.get('course_id')
        sentence_id = data.get('sentence_id')
        slot_index = data.get('slot_index')

        if not all([user_id, course_id, sentence_id is not None, slot_index is not None]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: user_id, course_id, sentence_id, slot_index"
            }), 400

        print(f"\n{'='*60}")
        print(f"🗑️  收到評分刪除請求")
        print(f"{'='*60}")
        print(f"user_id: {user_id}")
        print(f"course_id: {course_id}")
        print(f"sentence_id: {sentence_id}")
        print(f"slot_index: {slot_index}")
        print(f"{'='*60}\n")

        supabase = get_supabase_client()
        result = supabase.delete_ai_score(
            user_id=user_id,
            course_id=course_id,
            sentence_id=int(sentence_id),
            slot_index=int(slot_index)
        )

        if result['success']:
            return jsonify({"success": True})
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500

    except Exception as e:
        print(f"❌ 刪除評分失敗: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


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
    接收參考音檔與測試音檔，並回傳 AI 評分結果
    如果有提供 user_id 等參數，會先檢查資料庫是否已有評分

    Request (multipart/form-data):
        - reference_audio: 參考音訊檔案
        - test_audio: 要評分的音訊檔案
        - user_id (optional): 使用者 ID，用於儲存/讀取評分
        - course_id (optional): 課程 ID
        - sentence_id (optional): 句子 ID
        - slot_index (optional): 錄音槽位索引

    Response:
        {
            "success": true,
            "rating": float,  # 模型預測的人類評分 (1-5 分)
            "cached": bool    # 是否從資料庫讀取
        }
    """
    ref_path = None
    test_path = None
    wav_path = None

    try:
        from services.supabase_client import get_supabase_client

        reference_audio = request.files.get('reference_audio')
        test_audio = request.files.get('test_audio')

        if not reference_audio or not test_audio:
            return jsonify({"success": False, "error": "Missing files"}), 400

        # 取得可選參數（用於儲存/讀取評分）
        user_id = request.form.get('user_id')
        course_id = request.form.get('course_id')
        sentence_id_str = request.form.get('sentence_id')
        slot_index_str = request.form.get('slot_index')

        # Debug logging
        print(f"\n{'='*60}")
        print(f"📥 收到評分請求")
        print(f"{'='*60}")
        print(f"user_id: {user_id}")
        print(f"course_id: {course_id}")
        print(f"sentence_id: {sentence_id_str}")
        print(f"slot_index: {slot_index_str}")
        print(f"{'='*60}\n")

        # 如果提供了完整參數，先檢查資料庫是否已有評分
        if user_id and course_id and sentence_id_str and slot_index_str:
            try:
                sentence_id = int(sentence_id_str)
                slot_index = int(slot_index_str)

                supabase = get_supabase_client()
                cached_score = supabase.get_ai_score(
                    user_id=user_id,
                    course_id=course_id,
                    sentence_id=sentence_id,
                    slot_index=slot_index
                )

                if cached_score is not None:
                    print(f"✅ Using cached AI score: {cached_score:.2f}")
                    return jsonify({
                        "success": True,
                        "rating": cached_score,
                        "cached": True
                    })
            except (ValueError, Exception) as e:
                print(f"⚠️  Failed to check cached score: {str(e)}")
                # 繼續執行評分，不因為資料庫錯誤而中斷

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
        ], check=True, capture_output=True)

        # === 呼叫 AudioScorer 進行評分 ===
        scorer = AudioScorer()
        rating = scorer.score(ref_path, wav_path)

        # === 如果提供了完整參數，儲存評分到資料庫 ===
        if user_id and course_id and sentence_id_str and slot_index_str:
            try:
                sentence_id = int(sentence_id_str)
                slot_index = int(slot_index_str)

                supabase = get_supabase_client()
                save_result = supabase.save_ai_score(
                    user_id=user_id,
                    course_id=course_id,
                    sentence_id=sentence_id,
                    slot_index=slot_index,
                    score=rating
                )

                if not save_result['success']:
                    print(f"⚠️  Warning: Failed to save score to database: {save_result['error']}")
                    # 不因為儲存失敗而中斷，仍然回傳評分結果

            except (ValueError, Exception) as e:
                print(f"⚠️  Warning: Failed to save score: {str(e)}")
                # 繼續回傳結果

        return jsonify({
            "success": True,
            "rating": rating,
            "cached": False
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        # 無論成功失敗都刪掉暫存檔
        try:
            if ref_path and os.path.exists(ref_path):
                os.remove(ref_path)
            if test_path and os.path.exists(test_path):
                os.remove(test_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception:
            pass