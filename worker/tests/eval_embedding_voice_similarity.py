"""
語音相似度評估模組
使用 SpeechBrain 的 ECAPA-TDNN 模型計算兩個音檔之間的餘弦相似度
"""

import os
import torch
import soundfile as sf
from typing import Tuple, Optional
from speechbrain.inference.speaker import EncoderClassifier
from speechbrain.utils.fetching import LocalStrategy


class VoiceSimilarityEvaluator:
    """語音相似度評估器"""
    
    def __init__(self, model_source: str = "speechbrain/spkrec-ecapa-voxceleb"):
        """
        初始化語音相似度評估器
        
        Args:
            model_source: SpeechBrain 預訓練模型來源
        """
        # 設定 HuggingFace Token (如果需要)
        hf_token = os.getenv('HF_TOKEN_API_KEY')
        if hf_token:
            os.environ['HUGGING_FACE_HUB_TOKEN'] = hf_token
        
        # 載入預訓練模型
        # 使用 COPY 策略避免 Windows 符號連結權限問題
        self.classifier = EncoderClassifier.from_hparams(
            source=model_source,
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            local_strategy=LocalStrategy.COPY  # 使用複製策略，避免 Windows 符號連結權限問題
        )
        
    def _load_audio(self, audio_path: str) -> Tuple[torch.Tensor, int]:
        """
        載入音訊檔案
        
        Args:
            audio_path: 音訊檔案路徑
            
        Returns:
            Tuple[torch.Tensor, int]: (音訊信號, 採樣率)
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"音訊檔案不存在: {audio_path}")
        
        # 使用 soundfile 讀取音訊
        signal, fs = sf.read(audio_path)
        
        # 轉換為 torch tensor 並調整維度
        # soundfile 讀取的格式為 (samples, channels)，需要轉換為 (channels, samples)
        signal = torch.FloatTensor(signal).T
        
        # 如果是單聲道，添加一個維度
        if signal.dim() == 1:
            signal = signal.unsqueeze(0)
        
        return signal, fs
    
    def _get_embedding(self, audio_path: str) -> torch.Tensor:
        """
        提取音訊的 embedding
        
        Args:
            audio_path: 音訊檔案路徑
            
        Returns:
            torch.Tensor: 音訊 embedding 向量
        """
        signal, fs = self._load_audio(audio_path)
        embeddings = self.classifier.encode_batch(signal)
        return embeddings
    
    def _cosine_similarity(self, embedding1: torch.Tensor, embedding2: torch.Tensor) -> float:
        """
        計算兩個 embedding 之間的餘弦相似度
        
        Args:
            embedding1: 第一個 embedding 向量
            embedding2: 第二個 embedding 向量
            
        Returns:
            float: 餘弦相似度分數 (範圍: -1 到 1，越接近 1 表示越相似)
        """
        # 確保 embedding 是 2D tensor
        if embedding1.dim() == 3:
            embedding1 = embedding1.squeeze(0)
        if embedding2.dim() == 3:
            embedding2 = embedding2.squeeze(0)
        
        # 計算餘弦相似度
        similarity = torch.nn.functional.cosine_similarity(
            embedding1, 
            embedding2, 
            dim=-1
        )
        
        return similarity.item()
    
    def calculate_similarity(
        self, 
        audio_path1: str, 
        audio_path2: str,
        normalize_score: bool = True
    ) -> float:
        """
        計算兩個音檔之間的相似度分數
        
        Args:
            audio_path1: 第一個音訊檔案路徑
            audio_path2: 第二個音訊檔案路徑
            normalize_score: 是否將分數標準化到 0-100 範圍
            
        Returns:
            float: 相似度分數
                  - 若 normalize_score=True: 0-100 分 (100 表示完全相同)
                  - 若 normalize_score=False: -1 到 1 (1 表示完全相同)
        """
        # 提取兩個音檔的 embeddings
        embedding1 = self._get_embedding(audio_path1)
        embedding2 = self._get_embedding(audio_path2)
        
        # 計算餘弦相似度
        similarity = self._cosine_similarity(embedding1, embedding2)
        
        # 標準化分數到 0-100 範圍
        if normalize_score:
            # 將 -1~1 映射到 0~100
            score = (similarity + 1) * 50
            return round(score, 2)
        
        return round(similarity, 4)


def evaluate_voice_similarity(
    audio_path1: str, 
    audio_path2: str,
    model_source: str = "speechbrain/spkrec-ecapa-voxceleb",
    normalize_score: bool = True
) -> dict:
    """
    評估兩個音檔的語音相似度 (便利函數)
    
    Args:
        audio_path1: 第一個音訊檔案路徑
        audio_path2: 第二個音訊檔案路徑
        model_source: SpeechBrain 預訓練模型來源
        normalize_score: 是否將分數標準化到 0-100 範圍
        
    Returns:
        dict: 包含相似度分數和詳細資訊的字典
        {
            'similarity_score': float,  # 相似度分數
            'audio1': str,              # 第一個音檔路徑
            'audio2': str,              # 第二個音檔路徑
            'normalized': bool          # 是否標準化
        }
    """
    try:
        evaluator = VoiceSimilarityEvaluator(model_source=model_source)
        score = evaluator.calculate_similarity(
            audio_path1, 
            audio_path2,
            normalize_score=normalize_score
        )
        
        return {
            'similarity_score': score,
            'audio1': audio_path1,
            'audio2': audio_path2,
            'normalized': normalize_score,
            'status': 'success'
        }
    except Exception as e:
        return {
            'similarity_score': None,
            'audio1': audio_path1,
            'audio2': audio_path2,
            'normalized': normalize_score,
            'status': 'error',
            'error_message': str(e)
        }


if __name__ == "__main__":
    # 簡單測試
    print("語音相似度評估模組已載入")
    print("使用範例:")
    print("  from eval_embedding_voice_similarity import evaluate_voice_similarity")
    print("  result = evaluate_voice_similarity('audio1.wav', 'audio2.wav')")
    print("  print(result['similarity_score'])")
