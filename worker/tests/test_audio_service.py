"""
測試語音處理服務

使用方式：
    cd worker
    source .venv/bin/activate
    python tests/test_audio_service.py
"""
import os
import sys

# 添加 src 到路徑，讓我們可以 import service
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../src'))

from services.audio_service import transcribe_audio, analyze_pronunciation


def test_transcribe_audio():
    """測試語音轉文字功能"""
    print("=== 測試語音轉文字 ===")

    # 使用 temp 資料夾中的測試音檔
    test_audio_path = os.path.join(os.path.dirname(__file__), '../temp/test_audio.wav')

    if not os.path.exists(test_audio_path):
        print(f"⚠️  測試音檔不存在: {test_audio_path}")
        print("請先將測試音檔放入 worker/temp/ 資料夾")
        return

    # 呼叫你實作的 function
    result = transcribe_audio(test_audio_path, language='en')

    # 輸出結果
    print(f"✅ 轉錄文字: {result['text']}")
    print(f"✅ 信心度: {result['confidence']}")
    print()


def test_analyze_pronunciation():
    """測試發音評分功能"""
    print("=== 測試發音評分 ===")

    test_audio_path = os.path.join(os.path.dirname(__file__), '../temp/test_pronunciation.wav')
    reference_text = "Hello, how are you?"

    if not os.path.exists(test_audio_path):
        print(f"⚠️  測試音檔不存在: {test_audio_path}")
        return

    # 呼叫你實作的 function
    result = analyze_pronunciation(test_audio_path, reference_text, language='en')

    # 輸出結果
    print(f"✅ 總分: {result['score']}")
    print(f"✅ 準確度: {result['feedback']['accuracy']}")
    print(f"✅ 流暢度: {result['feedback']['fluency']}")
    print(f"✅ 完整度: {result['feedback']['completeness']}")
    print()


if __name__ == '__main__':
    # 執行測試
    print("開始測試語音處理服務...")
    print("=" * 50)
    print()

    test_transcribe_audio()
    test_analyze_pronunciation()

    print("=" * 50)
    print("✅ 所有測試完成")
