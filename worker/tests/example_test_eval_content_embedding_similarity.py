"""
語音內容相似度評估測試範例
模擬 app.py 引用 eval_content_embedding_similarity 模組的使用方式
測試內容 embedding - 關注「說了什麼」而非「誰在說話」
"""

import os
import sys
from pathlib import Path

# 將 tests 目錄加入 Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from eval_content_embedding_similarity import (
    evaluate_content_similarity,
    ContentSimilarityEvaluator
)


def test_basic_content_similarity():
    """測試基本內容相似度計算"""
    print("\n" + "="*60)
    print("測試 1: 基本內容相似度計算")
    print("="*60)
    
    # 使用 worker 目錄下的音檔
    base_path = Path(__file__).parent.parent
    audio1 = str(base_path / "arctic_6mix_1.wav")
    audio2 = str(base_path / "arctic_6mix_2.wav")
    
    print(f"音檔 1: {audio1}")
    print(f"音檔 2: {audio2}")
    print("說明: 比較兩個不同混音的語音內容相似度")
    
    # 檢查檔案是否存在
    if not os.path.exists(audio1):
        print(f"❌ 音檔不存在: {audio1}")
        return
    if not os.path.exists(audio2):
        print(f"❌ 音檔不存在: {audio2}")
        return
    
    # 計算內容相似度
    result = evaluate_content_similarity(audio1, audio2)
    
    if result['status'] == 'success':
        print(f"✅ 內容相似度分數: {result['similarity_score']}/100")
        print(f"   (分數越高表示語音內容越相似)")
    else:
        print(f"❌ 錯誤: {result['error_message']}")


def test_same_audio_content_similarity():
    """測試同一音檔的內容相似度 (應該接近 100 分)"""
    print("\n" + "="*60)
    print("測試 2: 同一音檔內容相似度 (預期: ~100 分)")
    print("="*60)
    
    base_path = Path(__file__).parent.parent
    audio1 = str(base_path / "arctic_6mix_1.wav")
    
    print(f"音檔 1: {audio1}")
    print(f"音檔 2: {audio1} (同一檔案)")
    print("說明: 同一檔案的內容應該完全相同")
    
    if not os.path.exists(audio1):
        print(f"❌ 音檔不存在: {audio1}")
        return
    
    result = evaluate_content_similarity(audio1, audio1)
    
    if result['status'] == 'success':
        print(f"✅ 內容相似度分數: {result['similarity_score']}/100")
        if result['similarity_score'] > 95:
            print("   ✓ 分數合理 (同一檔案內容應該接近 100 分)")
        else:
            print("   ⚠ 分數偏低 (可能有問題)")
    else:
        print(f"❌ 錯誤: {result['error_message']}")


def test_content_vs_speaker_comparison():
    """說明內容相似度 vs 說話者相似度的差異"""
    print("\n" + "="*60)
    print("測試 3: Content Embedding vs Speaker Embedding")
    print("="*60)
    
    print("📌 概念說明:")
    print("  • Content Embedding (內容嵌入):")
    print("    - 關注「說了什麼」(語義、音素)")
    print("    - 相同文字內容 = 高相似度")
    print("    - 不同說話者說相同內容 = 高相似度")
    print()
    print("  • Speaker Embedding (說話者嵌入):")
    print("    - 關注「誰在說話」(聲音特徵)")
    print("    - 相同說話者 = 高相似度")
    print("    - 說話者說不同內容 = 仍可能高相似度")
    print()
    print("📊 應用場景:")
    print("  • Content: 語音辨識、內容搜索、重複內容檢測")
    print("  • Speaker: 說話者識別、聲紋認證、說話者分離")


def test_multiple_content_comparisons():
    """測試使用評估器進行多次內容比較"""
    print("\n" + "="*60)
    print("測試 4: 使用評估器類別進行多次比較")
    print("="*60)
    
    base_path = Path(__file__).parent.parent
    audio1 = str(base_path / "arctic_6mix_1.wav")
    audio2 = str(base_path / "arctic_6mix_2.wav")
    
    if not os.path.exists(audio1) or not os.path.exists(audio2):
        print(f"❌ 音檔不存在")
        return
    
    # 建立評估器實例 (只載入模型一次，提高效率)
    print("正在載入 Content Embedding 模型...")
    try:
        evaluator = ContentSimilarityEvaluator()
        
        print(f"\n使用評估器進行多次內容比較:")
        
        # 比較 1: audio1 vs audio2
        score1 = evaluator.calculate_similarity(audio1, audio2)
        print(f"  arctic_6mix_1.wav vs arctic_6mix_2.wav: {score1}/100")
        
        # 比較 2: audio1 vs audio1 (同一檔案)
        score2 = evaluator.calculate_similarity(audio1, audio1)
        print(f"  arctic_6mix_1.wav vs arctic_6mix_1.wav: {score2}/100 (同一檔案)")
        
        # 比較 3: audio2 vs audio2 (同一檔案)
        score3 = evaluator.calculate_similarity(audio2, audio2)
        print(f"  arctic_6mix_2.wav vs arctic_6mix_2.wav: {score3}/100 (同一檔案)")
        
        print("\n✅ 批量比較完成")
        
    except Exception as e:
        print(f"  ❌ 錯誤 - {str(e)}")


def test_raw_cosine_similarity():
    """測試原始餘弦相似度 (未標準化)"""
    print("\n" + "="*60)
    print("測試 5: 原始餘弦相似度 (範圍: -1 到 1)")
    print("="*60)
    
    base_path = Path(__file__).parent.parent
    audio1 = str(base_path / "arctic_6mix_1.wav")
    audio2 = str(base_path / "arctic_6mix_2.wav")
    
    if not os.path.exists(audio1) or not os.path.exists(audio2):
        print("❌ 音檔不存在")
        return
    
    result = evaluate_content_similarity(audio1, audio2, normalize_score=False)
    
    if result['status'] == 'success':
        print(f"✅ 餘弦相似度: {result['similarity_score']}")
        print(f"   (範圍: -1 到 1，1 表示內容完全相同)")
    else:
        print(f"❌ 錯誤: {result['error_message']}")


def run_all_tests():
    """執行所有測試"""
    print("\n" + "🎯 "*20)
    print("開始執行語音內容相似度評估測試")
    print("(Content Embedding - 專注於語音內容)")
    print("🎯 "*20)
    
    try:
        # 測試 1: 基本功能
        test_basic_content_similarity()
        
        # 測試 2: 同一音檔
        test_same_audio_content_similarity()
        
        # 測試 3: 概念說明
        test_content_vs_speaker_comparison()
        
        # 測試 4: 批量比較
        test_multiple_content_comparisons()
        
        # 測試 5: 原始分數
        test_raw_cosine_similarity()
        
        print("\n" + "="*60)
        print("✅ 所有測試完成")
        print("="*60)
        
        print("\n💡 提示:")
        print("  - Content Embedding 分數反映語音「內容」的相似度")
        print("  - 若要比較「說話者」相似度，請使用 eval_embedding_voice_similarity.py")
        
    except Exception as e:
        print(f"\n❌ 測試過程發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # 檢查環境
    print("語音內容相似度評估測試程式")
    print("="*60)
    print(f"工作目錄: {os.getcwd()}")
    print(f"Python 版本: {sys.version}")
    print("="*60)
    
    # 執行測試
    run_all_tests()
