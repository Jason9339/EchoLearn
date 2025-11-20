"""
評分服務

使用訓練好的 Random Forest 模型來預測錄音評分 (1-5 星)
"""

import joblib
import numpy as np
import os

# 模型載入（全域變數，只載入一次）
_model = None
_METRIC_INFO = None
_SCORE_COLUMNS = None


def load_model(models_dir=None):
    """
    載入訓練好的評分模型

    Args:
        models_dir: 模型目錄路徑，如果為 None 則使用預設路徑
    """
    global _model, _METRIC_INFO, _SCORE_COLUMNS

    if _model is not None:
        return  # 已載入

    if models_dir is None:
        # 預設路徑
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        models_dir = os.path.join(base_dir, 'models')

    model_path = os.path.join(models_dir, 'random_forest.joblib')

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型檔案不存在: {model_path}")

    print(f"載入評分模型: {model_path}")
    _model = joblib.load(model_path)

    # 指標定義 (與訓練時一致)
    _METRIC_INFO = {
        'score_PER': {'reverse': True},
        'score_PPG': {'reverse': False},
        'score_WER': {'reverse': True},
        'score_GOP': {'reverse': False},
        'score_GPE_offset': {'reverse': False},
        'score_FFE': {'reverse': False},
        'score_Energy': {'reverse': False},
        'score_VDE': {'reverse': False}
    }

    _SCORE_COLUMNS = list(_METRIC_INFO.keys())

    print("✅ 評分模型載入成功")


def predict_score(metrics: dict) -> dict:
    """
    預測錄音評分

    Args:
        metrics: 包含 8 個指標的字典
            {
                'score_PER': float,
                'score_PPG': float,
                'score_WER': float,
                'score_GOP': float,
                'score_GPE_offset': float,
                'score_FFE': float,
                'score_Energy': float,
                'score_VDE': float
            }

    Returns:
        {
            'score': float,          # 1.0 - 5.0 的預測分數
            'score_int': int,        # 四捨五入的整數星級 (1-5)
            'score_half': float,     # 四捨五入到 0.5 星 (1.0, 1.5, 2.0, ...)
            'confidence': str        # 信心等級 (high/medium/low)
        }
    """
    global _model, _METRIC_INFO, _SCORE_COLUMNS

    if _model is None:
        raise RuntimeError("模型尚未載入，請先呼叫 load_model()")

    # 檢查必要指標是否存在
    missing_metrics = [col for col in _SCORE_COLUMNS if col not in metrics]
    if missing_metrics:
        raise ValueError(f"缺少必要指標: {missing_metrics}")

    # 準備特徵向量
    features = []
    for col in _SCORE_COLUMNS:
        score = metrics[col]

        # 檢查數值有效性
        if score is None or np.isnan(score):
            raise ValueError(f"指標 {col} 的值無效: {score}")

        # 如果是 error rate，反轉 (讓所有指標都是「越高越好」)
        if _METRIC_INFO[col]['reverse']:
            score = 1 - score

        features.append(score)

    X = np.array([features])

    # 預測
    predicted_score = _model.predict(X)[0]

    # 限制在 1-5 範圍
    predicted_score = np.clip(predicted_score, 1.0, 5.0)

    # 四捨五入到整數
    score_int = int(np.round(predicted_score))

    # 四捨五入到 0.5 星
    score_half = np.round(predicted_score * 2) / 2

    # 簡單的信心估計 (基於預測值與整數的距離)
    distance_to_int = abs(predicted_score - score_int)
    if distance_to_int < 0.3:
        confidence = 'high'
    elif distance_to_int < 0.6:
        confidence = 'medium'
    else:
        confidence = 'low'

    return {
        'score': float(predicted_score),
        'score_int': score_int,
        'score_half': float(score_half),
        'confidence': confidence
    }


def get_feature_importance() -> dict:
    """
    取得各指標的重要性

    Returns:
        {
            'score_PPG': 0.2235,
            'score_Energy': 0.1609,
            ...
        }
    """
    global _model, _SCORE_COLUMNS

    if _model is None:
        raise RuntimeError("模型尚未載入，請先呼叫 load_model()")

    if not hasattr(_model, 'feature_importances_'):
        raise RuntimeError("模型不支援 feature_importances_")

    importances = _model.feature_importances_

    return {
        col: float(imp)
        for col, imp in zip(_SCORE_COLUMNS, importances)
    }


def batch_predict(metrics_list: list) -> list:
    """
    批次預測多個錄音的評分

    Args:
        metrics_list: 包含多個 metrics 字典的列表

    Returns:
        預測結果的列表
    """
    return [predict_score(metrics) for metrics in metrics_list]


if __name__ == '__main__':
    # 測試評分服務
    print("=" * 60)
    print("評分服務測試")
    print("=" * 60)

    # 載入模型
    load_model()

    # 測試案例 1: 高品質錄音
    high_quality_metrics = {
        'score_PER': 0.05,      # 低錯誤率 (好)
        'score_PPG': 0.85,      # 高音素後驗概率 (好)
        'score_WER': 0.08,      # 低詞錯誤率 (好)
        'score_GOP': 0.75,      # 高 GOP (好)
        'score_GPE_offset': 0.80,  # 高 GPE (好)
        'score_FFE': 0.82,      # 高頻譜相似度 (好)
        'score_Energy': 0.88,   # 高能量相似度 (好)
        'score_VDE': 0.78       # 高聲音距離 (好)
    }

    result_high = predict_score(high_quality_metrics)
    print("\n測試案例 1: 高品質錄音")
    print(f"  預測分數: {result_high['score']:.2f} 星")
    print(f"  整數星級: {result_high['score_int']} 星")
    print(f"  半星評分: {result_high['score_half']} 星")
    print(f"  信心等級: {result_high['confidence']}")

    # 測試案例 2: 低品質錄音
    low_quality_metrics = {
        'score_PER': 0.35,      # 高錯誤率 (差)
        'score_PPG': 0.45,      # 低音素後驗概率 (差)
        'score_WER': 0.42,      # 高詞錯誤率 (差)
        'score_GOP': 0.38,      # 低 GOP (差)
        'score_GPE_offset': 0.40,
        'score_FFE': 0.42,
        'score_Energy': 0.48,
        'score_VDE': 0.35
    }

    result_low = predict_score(low_quality_metrics)
    print("\n測試案例 2: 低品質錄音")
    print(f"  預測分數: {result_low['score']:.2f} 星")
    print(f"  整數星級: {result_low['score_int']} 星")
    print(f"  半星評分: {result_low['score_half']} 星")
    print(f"  信心等級: {result_low['confidence']}")

    # 測試案例 3: 中等品質錄音
    medium_quality_metrics = {
        'score_PER': 0.18,
        'score_PPG': 0.65,
        'score_WER': 0.22,
        'score_GOP': 0.58,
        'score_GPE_offset': 0.62,
        'score_FFE': 0.60,
        'score_Energy': 0.68,
        'score_VDE': 0.55
    }

    result_medium = predict_score(medium_quality_metrics)
    print("\n測試案例 3: 中等品質錄音")
    print(f"  預測分數: {result_medium['score']:.2f} 星")
    print(f"  整數星級: {result_medium['score_int']} 星")
    print(f"  半星評分: {result_medium['score_half']} 星")
    print(f"  信心等級: {result_medium['confidence']}")

    # 顯示特徵重要性
    print("\n" + "=" * 60)
    print("特徵重要性排名")
    print("=" * 60)

    importances = get_feature_importance()
    sorted_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)

    for feature, importance in sorted_features:
        print(f"  {feature:20s}: {importance:.4f}")

    print("\n✅ 評分服務測試完成")
