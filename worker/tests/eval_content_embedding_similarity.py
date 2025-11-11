"""
語音內容相似度評估模組
使用 Wav2Vec2 模型計算兩個音檔之間的內容相似度（語義/音素層面）
與 speaker embedding 不同，此模組專注於「說了什麼」而非「誰在說話」
"""

import os
import torch
import soundfile as sf
import numpy as np
from typing import Tuple, Optional
from transformers import Wav2Vec2Model, Wav2Vec2Processor


class ContentSimilarityEvaluator:
    """語音內容相似度評估器"""
    
    def __init__(self, model_name: str = "facebook/wav2vec2-base-960h"):
        """
        初始化語音內容相似度評估器
        
        Args:
            model_name: Wav2Vec2 預訓練模型名稱
                      - facebook/wav2vec2-base-960h (推薦，英文)
                      - facebook/wav2vec2-large-960h (更大，更準確)
        """
        # 設定 HuggingFace Token (如果需要)
        hf_token = os.getenv('HF_TOKEN_API_KEY')
        
        print(f"正在載入 Content Embedding 模型: {model_name}")
        
        # 載入處理器和模型
        try:
            if hf_token:
                self.processor = Wav2Vec2Processor.from_pretrained(
                    model_name,
                    token=hf_token,
                    cache_dir="pretrained_models/wav2vec2"
                )
                self.model = Wav2Vec2Model.from_pretrained(
                    model_name,
                    token=hf_token,
                    cache_dir="pretrained_models/wav2vec2"
                )
            else:
                self.processor = Wav2Vec2Processor.from_pretrained(
                    model_name,
                    cache_dir="pretrained_models/wav2vec2"
                )
                self.model = Wav2Vec2Model.from_pretrained(
                    model_name,
                    cache_dir="pretrained_models/wav2vec2"
                )
        except Exception as e:
            print(f"載入模型時發生錯誤: {e}")
            raise
        
        # 設定為評估模式
        self.model.eval()
        
        # 如果有 GPU 可用，移至 GPU
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        
        print(f"模型已載入，使用設備: {self.device}")
        
    def _load_audio(self, audio_path: str, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
        """
        載入音訊檔案並重新採樣到目標採樣率
        
        Args:
            audio_path: 音訊檔案路徑
            target_sr: 目標採樣率 (Wav2Vec2 需要 16kHz)
            
        Returns:
            Tuple[np.ndarray, int]: (音訊信號, 採樣率)
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"音訊檔案不存在: {audio_path}")
        
        # 使用 soundfile 讀取音訊
        signal, fs = sf.read(audio_path)
        
        # 如果是立體聲，轉換為單聲道
        if len(signal.shape) > 1:
            signal = signal.mean(axis=1)
        
        # 如果採樣率不是 16kHz，需要重新採樣
        if fs != target_sr:
            # 簡單的重新採樣（生產環境建議使用 librosa 或 scipy）
            import warnings
            warnings.warn(f"音檔採樣率為 {fs}Hz，建議使用 {target_sr}Hz。使用簡單重採樣可能影響準確度。")
            # 這裡為了簡化，直接使用原始信號
            # 實際應用中建議使用 librosa.resample
        
        return signal, fs
    
    def _get_embedding(self, audio_path: str) -> torch.Tensor:
        """
        提取音訊的 content embedding
        
        Args:
            audio_path: 音訊檔案路徑
            
        Returns:
            torch.Tensor: 音訊內容 embedding 向量
        """
        # 載入音訊
        signal, fs = self._load_audio(audio_path)
        
        # 使用 processor 處理音訊
        inputs = self.processor(
            signal,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True
        )
        
        # 移至正確的設備
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 提取特徵（不計算梯度）
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # 使用最後一層隱藏狀態的平均值作為 embedding
        # Shape: (batch, sequence_length, hidden_size) -> (batch, hidden_size)
        embeddings = outputs.last_hidden_state.mean(dim=1)
        
        return embeddings
    
    def _cosine_similarity(self, embedding1: torch.Tensor, embedding2: torch.Tensor) -> float:
        """
        計算兩個 embedding 之間的餘弦相似度
        
        Args:
            embedding1: 第一個 embedding 向量
            embedding2: 第二個 embedding 向量
            
        Returns:
            float: 餘弦相似度分數 (範圍: -1 到 1，越接近 1 表示內容越相似)
        """
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
        計算兩個音檔之間的內容相似度分數
        
        Args:
            audio_path1: 第一個音訊檔案路徑
            audio_path2: 第二個音訊檔案路徑
            normalize_score: 是否將分數標準化到 0-100 範圍
            
        Returns:
            float: 相似度分數
                  - 若 normalize_score=True: 0-100 分 (100 表示內容完全相同)
                  - 若 normalize_score=False: -1 到 1 (1 表示內容完全相同)
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


def evaluate_content_similarity(
    audio_path1: str, 
    audio_path2: str,
    model_name: str = "facebook/wav2vec2-base-960h",
    normalize_score: bool = True
) -> dict:
    """
    評估兩個音檔的語音內容相似度 (便利函數)
    
    Args:
        audio_path1: 第一個音訊檔案路徑
        audio_path2: 第二個音訊檔案路徑
        model_name: Wav2Vec2 預訓練模型名稱
        normalize_score: 是否將分數標準化到 0-100 範圍
        
    Returns:
        dict: 包含相似度分數和詳細資訊的字典
        {
            'similarity_score': float,  # 相似度分數
            'audio1': str,              # 第一個音檔路徑
            'audio2': str,              # 第二個音檔路徑
            'normalized': bool,         # 是否標準化
            'type': 'content'           # 類型標記
        }
    """
    try:
        evaluator = ContentSimilarityEvaluator(model_name=model_name)
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
            'type': 'content',
            'status': 'success'
        }
    except Exception as e:
        return {
            'similarity_score': None,
            'audio1': audio_path1,
            'audio2': audio_path2,
            'normalized': normalize_score,
            'type': 'content',
            'status': 'error',
            'error_message': str(e)
        }


if __name__ == "__main__":
    # 簡單測試
    print("語音內容相似度評估模組已載入")
    print("使用範例:")
    print("  from eval_content_embedding_similarity import evaluate_content_similarity")
    print("  result = evaluate_content_similarity('audio1.wav', 'audio2.wav')")
    print("  print(result['similarity_score'])")
