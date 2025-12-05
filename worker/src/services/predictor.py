"""
EchoLearn 發音評分預測器
使用 3 個特徵（PER, PPG, Energy）預測人類評分（1-5 分）

使用方法:
    from predictor import RatingPredictor

    predictor = RatingPredictor()
    rating = predictor.predict({
        'score_PER': 0.85,
        'score_PPG': 0.995,
        'score_Energy': 0.95
    })
    print(f"預測評分: {rating:.2f}")
"""

import torch
import torch.nn as nn
import numpy as np
import pickle
from pathlib import Path


class TinyModel(nn.Module):
    """極簡模型架構 (3→32→1)"""
    def __init__(self, input_dim=3):
        super(TinyModel, self).__init__()
        self.fc1 = nn.Linear(input_dim, 32)
        self.dropout1 = nn.Dropout(0.2)
        self.fc2 = nn.Linear(32, 1)

        # Xavier Normal 初始化
        nn.init.xavier_normal_(self.fc1.weight)
        nn.init.xavier_normal_(self.fc2.weight)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.dropout1(x)
        x = self.fc2(x)
        return x.squeeze()


class RatingPredictor:
    """
    人類評分預測器

    使用 3 個特徵預測 1-5 分的人類評分
    """

    def __init__(self, model_path=None, scaler_path=None):
        """
        初始化預測器

        Args:
            model_path: 模型檔案路徑（預設: model_3f_tiny.pth）
            scaler_path: 標準化器路徑（預設: model_3features_scaler.pkl）
        """
        # 設定預設路徑
        base_dir = Path(__file__).parent
        if model_path is None:
            model_path = base_dir / 'model_3f_tiny.pth'
        if scaler_path is None:
            scaler_path = base_dir / 'model_3features_scaler.pkl'

        # 設定設備
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        # 載入模型
        self.model = TinyModel(input_dim=3)
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model = self.model.to(self.device)
        self.model.eval()

        # 載入標準化器
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)

        print(f"✅ 模型已載入")
        print(f"   - 設備: {self.device}")
        print(f"   - 特徵: PER, PPG, Energy")
        print(f"   - 輸出: 1-5 分")

    def predict(self, features):
        """
        預測人類評分

        Args:
            features: dict 或 list
                - dict: {'score_PER': float, 'score_PPG': float, 'score_Energy': float}
                - list: [PER, PPG, Energy]

        Returns:
            float: 預測的人類評分 (1-5 分)

        範例:
            >>> predictor = RatingPredictor()
            >>> rating = predictor.predict({
            ...     'score_PER': 0.85,
            ...     'score_PPG': 0.995,
            ...     'score_Energy': 0.95
            ... })
            >>> print(f"{rating:.2f}")
            5.00
        """
        # 轉換為 list
        if isinstance(features, dict):
            feature_order = ['score_PER', 'score_PPG', 'score_Energy']
            features = [features[key] for key in feature_order]

        # 轉換為 numpy array
        features = np.array(features).reshape(1, -1)

        # 標準化
        features_scaled = self.scaler.transform(features)

        # 轉換為 tensor
        features_tensor = torch.FloatTensor(features_scaled).to(self.device)

        # 預測
        with torch.no_grad():
            prediction = self.model(features_tensor).cpu().item()

        # 限制在 1-5 範圍內
        prediction = max(1.0, min(5.0, prediction))

        return prediction

    def predict_batch(self, features_list):
        """
        批次預測人類評分

        Args:
            features_list: list of dict 或 list of list
                每個元素格式同 predict()

        Returns:
            list: 預測的人類評分列表

        範例:
            >>> predictor = RatingPredictor()
            >>> ratings = predictor.predict_batch([
            ...     {'score_PER': 0.9, 'score_PPG': 0.998, 'score_Energy': 0.96},
            ...     {'score_PER': 0.6, 'score_PPG': 0.990, 'score_Energy': 0.90}
            ... ])
            >>> print(ratings)
            [4.85, 3.22]
        """
        predictions = []
        for features in features_list:
            prediction = self.predict(features)
            predictions.append(prediction)

        return predictions

    def get_model_info(self):
        """
        取得模型資訊

        Returns:
            dict: 模型資訊
        """
        return {
            'features': ['score_PER', 'score_PPG', 'score_Energy'],
            'architecture': '3 → 32 → 1',
            'parameters': 161,
            'output_range': '1-5',
            'mae': 0.60,
            'rmse': 0.77,
            'r2': 0.32,
            'correlation': 0.57
        }


# ============ 使用範例 ============

if __name__ == '__main__':
    print("=" * 70)
    print("EchoLearn 發音評分預測器")
    print("=" * 70)

    # 初始化預測器
    predictor = RatingPredictor()

    # 顯示模型資訊
    print("\n模型資訊:")
    info = predictor.get_model_info()
    for key, value in info.items():
        print(f"  {key}: {value}")

    # 範例 1: 使用字典格式
    print("\n" + "=" * 70)
    print("範例 1: 單一預測（字典格式）")
    print("-" * 70)

    features = {
        'score_PER': 0.85,
        'score_PPG': 0.995,
        'score_Energy': 0.95
    }

    print("輸入特徵:")
    for key, value in features.items():
        print(f"  {key}: {value}")

    rating = predictor.predict(features)
    print(f"\n預測評分: {rating:.2f}")

    # 範例 2: 使用列表格式
    print("\n" + "=" * 70)
    print("範例 2: 單一預測（列表格式）")
    print("-" * 70)

    features_list = [0.75, 0.992, 0.93]
    print(f"輸入特徵 (PER, PPG, Energy): {features_list}")

    rating = predictor.predict(features_list)
    print(f"預測評分: {rating:.2f}")

    # 範例 3: 批次預測
    print("\n" + "=" * 70)
    print("範例 3: 批次預測")
    print("-" * 70)

    batch = [
        {'score_PER': 0.9, 'score_PPG': 0.998, 'score_Energy': 0.96},
        {'score_PER': 0.6, 'score_PPG': 0.990, 'score_Energy': 0.90},
        {'score_PER': 0.45, 'score_PPG': 0.985, 'score_Energy': 0.88}
    ]

    ratings = predictor.predict_batch(batch)

    print(f"預測了 {len(ratings)} 筆資料:")
    for i, (feat, rating) in enumerate(zip(batch, ratings)):
        print(f"  樣本 {i+1}: PER={feat['score_PER']:.2f}, "
              f"PPG={feat['score_PPG']:.3f}, "
              f"Energy={feat['score_Energy']:.2f} "
              f"→ 評分: {rating:.2f}")

    # 範例 4: 評分等級判斷
    print("\n" + "=" * 70)
    print("範例 4: 評分等級判斷")
    print("-" * 70)

    def get_rating_level(rating):
        """根據評分返回等級"""
        if rating >= 4.5:
            return "優秀 ⭐⭐⭐⭐⭐"
        elif rating >= 3.5:
            return "良好 ⭐⭐⭐⭐"
        elif rating >= 2.5:
            return "中等 ⭐⭐⭐"
        else:
            return "需改進 ⭐⭐"

    test_cases = [
        {'score_PER': 0.95, 'score_PPG': 0.998, 'score_Energy': 0.97},
        {'score_PER': 0.80, 'score_PPG': 0.995, 'score_Energy': 0.92},
        {'score_PER': 0.65, 'score_PPG': 0.988, 'score_Energy': 0.85},
        {'score_PER': 0.45, 'score_PPG': 0.980, 'score_Energy': 0.80}
    ]

    print(f"{'PER':<6} {'PPG':<6} {'Energy':<8} {'評分':<8} {'等級':<20}")
    print("-" * 70)

    for features in test_cases:
        rating = predictor.predict(features)
        level = get_rating_level(rating)
        print(f"{features['score_PER']:<6.2f} "
              f"{features['score_PPG']:<6.3f} "
              f"{features['score_Energy']:<8.2f} "
              f"{rating:<8.2f} {level}")

    print("\n" + "=" * 70)
    print("預測完成！")
    print("=" * 70)
