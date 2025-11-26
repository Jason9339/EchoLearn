"""
實驗二：神經網路評分模型

設計簡單有效的 DL 模型來預測 1-5 星評分
排除 WER 以支援多語言（7 個特徵）

模型架構：
1. MLP Regressor - 簡單多層感知機
2. MLP Classifier - 將評分視為 5 分類問題
3. Ordinal Regression - 有序分類（考慮星級順序）

注意：此腳本設計用於 GPU 機器執行
"""

import json
import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# 配置：排除 WER，支援多語言
# ============================================================
FEATURE_COLUMNS = [
    'score_PER',        # Phoneme Error Rate (reverse)
    'score_PPG',        # Phoneme Posteriorgram
    'score_GOP',        # Goodness of Pronunciation
    'score_GPE_offset', # Pronunciation Evaluation
    'score_FFE',        # Formant Fluency
    'score_Energy',     # Energy Similarity
    'score_VDE'         # Voice Distance
]

REVERSE_FEATURES = ['score_PER']  # 需要反轉的特徵（error rate）

NUM_FEATURES = len(FEATURE_COLUMNS)
NUM_CLASSES = 5  # 1-5 星


# ============================================================
# 資料載入
# ============================================================
def load_data(dataset_path, min_raters=1):
    """載入資料（排除 WER）"""
    print(f"載入資料集...")
    print(f"使用特徵 ({NUM_FEATURES} 個，已排除 WER)：")
    for col in FEATURE_COLUMNS:
        print(f"  - {col}")

    with open(dataset_path, 'r') as f:
        data = json.load(f)

    rated_data = [d for d in data if d.get('rating_count', 0) >= min_raters]

    X = []
    y = []

    for item in rated_data:
        features = []
        valid = True

        for col in FEATURE_COLUMNS:
            if col not in item or item[col] is None:
                valid = False
                break
            score = item[col]
            # 反轉 error rate
            if col in REVERSE_FEATURES:
                score = 1 - score
            features.append(score)

        if valid and 'rating_avg' in item:
            X.append(features)
            y.append(item['rating_avg'])

    return np.array(X), np.array(y)


# ============================================================
# 模型 1: MLP Regressor
# ============================================================
class MLPRegressor(nn.Module):
    """
    簡單的多層感知機回歸模型

    架構：
    - Input: 7 features
    - Hidden 1: 32 neurons + ReLU + Dropout
    - Hidden 2: 16 neurons + ReLU + Dropout
    - Output: 1 (rating score)
    """
    def __init__(self, input_dim=NUM_FEATURES, hidden_dims=[32, 16], dropout=0.3):
        super(MLPRegressor, self).__init__()

        layers = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.BatchNorm1d(hidden_dim),
                nn.Dropout(dropout)
            ])
            prev_dim = hidden_dim

        layers.append(nn.Linear(prev_dim, 1))

        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x).squeeze(-1)


# ============================================================
# 模型 2: MLP Classifier (5 類別)
# ============================================================
class MLPClassifier(nn.Module):
    """
    多層感知機分類模型

    將 1-5 星視為 5 個類別
    輸出 softmax 機率分佈
    """
    def __init__(self, input_dim=NUM_FEATURES, hidden_dims=[64, 32], dropout=0.3):
        super(MLPClassifier, self).__init__()

        layers = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.BatchNorm1d(hidden_dim),
                nn.Dropout(dropout)
            ])
            prev_dim = hidden_dim

        layers.append(nn.Linear(prev_dim, NUM_CLASSES))

        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x)

    def predict_star(self, x):
        """預測星級 (1-5)"""
        logits = self.forward(x)
        return torch.argmax(logits, dim=1) + 1  # 類別 0-4 → 星級 1-5


# ============================================================
# 模型 3: Ordinal Regression (有序分類)
# ============================================================
class OrdinalRegressor(nn.Module):
    """
    有序回歸模型

    考慮星級的順序性：1 < 2 < 3 < 4 < 5
    使用累積機率建模：P(Y > k) for k = 1,2,3,4

    優點：
    - 考慮到 3 星比 4 星更接近 2 星
    - 預測更平滑
    """
    def __init__(self, input_dim=NUM_FEATURES, hidden_dims=[32, 16], dropout=0.3):
        super(OrdinalRegressor, self).__init__()

        layers = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.BatchNorm1d(hidden_dim),
                nn.Dropout(dropout)
            ])
            prev_dim = hidden_dim

        # 輸出 4 個累積機率閾值
        layers.append(nn.Linear(prev_dim, NUM_CLASSES - 1))

        self.network = nn.Sequential(*layers)

    def forward(self, x):
        # 輸出累積 logits
        return self.network(x)

    def predict_proba(self, x):
        """計算每個星級的機率"""
        cum_logits = self.forward(x)
        cum_probs = torch.sigmoid(cum_logits)

        # P(Y = k) = P(Y > k-1) - P(Y > k)
        probs = torch.zeros(x.size(0), NUM_CLASSES, device=x.device)
        probs[:, 0] = 1 - cum_probs[:, 0]

        for k in range(1, NUM_CLASSES - 1):
            probs[:, k] = cum_probs[:, k-1] - cum_probs[:, k]

        probs[:, -1] = cum_probs[:, -1]
        return probs

    def predict_star(self, x):
        """預測星級 (1-5)"""
        probs = self.predict_proba(x)
        return torch.argmax(probs, dim=1) + 1

    def predict_expected(self, x):
        """計算期望值（加權平均）"""
        probs = self.predict_proba(x)
        stars = torch.arange(1, NUM_CLASSES + 1, dtype=torch.float32, device=x.device)
        return torch.sum(probs * stars, dim=1)


# ============================================================
# 訓練函數
# ============================================================
def train_regressor(model, train_loader, val_loader, epochs=100, lr=0.001, device='cpu'):
    """訓練回歸模型"""
    model = model.to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    best_val_loss = float('inf')
    best_model_state = None
    patience_counter = 0

    # 檢查是否是 Ordinal Regressor（需要特殊處理）
    is_ordinal = isinstance(model, OrdinalRegressor)

    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)

            optimizer.zero_grad()

            if is_ordinal:
                # Ordinal: 使用期望值預測
                outputs = model.predict_expected(X_batch)
            else:
                outputs = model(X_batch)

            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()

        train_loss /= len(train_loader)

        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)

                if is_ordinal:
                    outputs = model.predict_expected(X_batch)
                else:
                    outputs = model(X_batch)

                val_loss += criterion(outputs, y_batch).item()

        val_loss /= len(val_loader)
        scheduler.step(val_loss)

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_model_state = model.state_dict().copy()
            patience_counter = 0
        else:
            patience_counter += 1

        if patience_counter >= 20:
            print(f"Early stopping at epoch {epoch+1}")
            break

        if (epoch + 1) % 20 == 0:
            print(f"Epoch {epoch+1}: Train Loss = {train_loss:.4f}, Val Loss = {val_loss:.4f}")

    model.load_state_dict(best_model_state)
    return model


def train_classifier(model, train_loader, val_loader, epochs=100, lr=0.001, device='cpu'):
    """訓練分類模型"""
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    best_val_acc = 0
    best_model_state = None

    for epoch in range(epochs):
        # Training
        model.train()
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            y_class = (y_batch.round() - 1).long().clamp(0, 4)  # 1-5 → 0-4

            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_class)
            loss.backward()
            optimizer.step()

        # Validation
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)
                y_class = (y_batch.round() - 1).long().clamp(0, 4)

                outputs = model(X_batch)
                _, predicted = torch.max(outputs, 1)
                total += y_batch.size(0)
                correct += (predicted == y_class).sum().item()

        val_acc = correct / total

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()

        if (epoch + 1) % 20 == 0:
            print(f"Epoch {epoch+1}: Val Accuracy = {val_acc*100:.2f}%")

    model.load_state_dict(best_model_state)
    return model


# ============================================================
# 評估函數
# ============================================================
def evaluate_model(y_true, y_pred, model_name):
    """評估模型表現"""
    y_pred = np.clip(y_pred, 1, 5)

    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)

    # 整數星級準確率
    y_true_int = np.round(y_true).astype(int)
    y_pred_int = np.round(y_pred).astype(int)
    exact_acc = np.mean(y_true_int == y_pred_int) * 100

    # 相鄰星級準確率 (±1 星)
    adjacent_acc = np.mean(np.abs(y_true_int - y_pred_int) <= 1) * 100

    print(f"\n{model_name}:")
    print(f"  RMSE:             {rmse:.4f} 星")
    print(f"  MAE:              {mae:.4f} 星")
    print(f"  精確匹配準確率:    {exact_acc:.2f}%")
    print(f"  相鄰星級準確率:    {adjacent_acc:.2f}% ← 主要指標")

    return {
        'rmse': float(rmse),
        'mae': float(mae),
        'exact_accuracy': float(exact_acc),
        'adjacent_accuracy': float(adjacent_acc)
    }


# ============================================================
# 主程式
# ============================================================
def main():
    print("="*80)
    print("實驗二：神經網路評分模型")
    print("="*80)
    print("\n注意：已排除 WER 以支援多語言")

    # 設備檢測
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"使用設備: {device}")

    if device == 'cpu':
        print("⚠️  未檢測到 GPU，將使用 CPU 訓練（較慢）")

    # 路徑設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    worker_dir = os.path.dirname(base_dir)
    dataset_path = os.path.join(worker_dir, 'temp/dataset/dataset.json')

    # 載入資料
    X, y = load_data(dataset_path, min_raters=1)
    print(f"\n樣本數: {len(X)}")

    # 分割資料
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42
    )

    print(f"訓練集: {len(X_train)}, 驗證集: {len(X_val)}, 測試集: {len(X_test)}")

    # 特徵標準化
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # 轉換為 PyTorch tensors
    train_dataset = TensorDataset(
        torch.FloatTensor(X_train_scaled),
        torch.FloatTensor(y_train)
    )
    val_dataset = TensorDataset(
        torch.FloatTensor(X_val_scaled),
        torch.FloatTensor(y_val)
    )
    test_dataset = TensorDataset(
        torch.FloatTensor(X_test_scaled),
        torch.FloatTensor(y_test)
    )

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32)
    test_loader = DataLoader(test_dataset, batch_size=32)

    results = {}

    # ============================================================
    # 模型 1: MLP Regressor
    # ============================================================
    print("\n" + "="*80)
    print("訓練模型 1: MLP Regressor")
    print("="*80)

    mlp_reg = MLPRegressor(input_dim=NUM_FEATURES, hidden_dims=[32, 16], dropout=0.3)
    print(f"模型架構:\n{mlp_reg}")

    mlp_reg = train_regressor(mlp_reg, train_loader, val_loader,
                               epochs=100, lr=0.001, device=device)

    # 評估
    mlp_reg.eval()
    with torch.no_grad():
        X_test_tensor = torch.FloatTensor(X_test_scaled).to(device)
        y_pred_reg = mlp_reg(X_test_tensor).cpu().numpy()

    results['mlp_regressor'] = evaluate_model(y_test, y_pred_reg, "MLP Regressor")

    # ============================================================
    # 模型 2: MLP Classifier
    # ============================================================
    print("\n" + "="*80)
    print("訓練模型 2: MLP Classifier (5 類別)")
    print("="*80)

    mlp_cls = MLPClassifier(input_dim=NUM_FEATURES, hidden_dims=[64, 32], dropout=0.3)
    print(f"模型架構:\n{mlp_cls}")

    mlp_cls = train_classifier(mlp_cls, train_loader, val_loader,
                                epochs=100, lr=0.001, device=device)

    # 評估
    mlp_cls.eval()
    with torch.no_grad():
        X_test_tensor = torch.FloatTensor(X_test_scaled).to(device)
        y_pred_cls = mlp_cls.predict_star(X_test_tensor).cpu().numpy().astype(float)

    results['mlp_classifier'] = evaluate_model(y_test, y_pred_cls, "MLP Classifier")

    # ============================================================
    # 模型 3: Ordinal Regressor
    # ============================================================
    print("\n" + "="*80)
    print("訓練模型 3: Ordinal Regressor")
    print("="*80)

    ord_reg = OrdinalRegressor(input_dim=NUM_FEATURES, hidden_dims=[32, 16], dropout=0.3)
    print(f"模型架構:\n{ord_reg}")

    ord_reg = train_regressor(ord_reg, train_loader, val_loader,
                               epochs=100, lr=0.001, device=device)

    # 評估（使用期望值）
    ord_reg.eval()
    with torch.no_grad():
        X_test_tensor = torch.FloatTensor(X_test_scaled).to(device)
        y_pred_ord = ord_reg.predict_expected(X_test_tensor).cpu().numpy()

    results['ordinal_regressor'] = evaluate_model(y_test, y_pred_ord, "Ordinal Regressor")

    # ============================================================
    # 結果比較
    # ============================================================
    print("\n" + "="*80)
    print("📊 模型比較總結")
    print("="*80)

    print(f"\n{'模型':<20} {'RMSE':<10} {'MAE':<10} {'精確匹配':<12} {'相鄰準確率':<12}")
    print("-" * 65)

    for model_name, metrics in results.items():
        print(f"{model_name:<20} {metrics['rmse']:<10.4f} {metrics['mae']:<10.4f} "
              f"{metrics['exact_accuracy']:<12.2f} {metrics['adjacent_accuracy']:<12.2f}")

    # 找最佳模型
    best_model = max(results.items(), key=lambda x: x[1]['adjacent_accuracy'])
    print(f"\n🏆 最佳模型: {best_model[0]} (相鄰準確率: {best_model[1]['adjacent_accuracy']:.2f}%)")

    # ============================================================
    # 儲存結果
    # ============================================================
    output_dir = os.path.join(base_dir, 'results')
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, 'neural_network_results.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'features': FEATURE_COLUMNS,
            'excluded_features': ['score_WER'],
            'num_features': NUM_FEATURES,
            'device': device,
            'results': results,
            'best_model': best_model[0]
        }, f, indent=2, ensure_ascii=False)

    print(f"\n✅ 結果已儲存: {output_path}")

    # 儲存模型（如果需要）
    model_dir = os.path.join(base_dir, 'models')
    os.makedirs(model_dir, exist_ok=True)

    torch.save({
        'mlp_regressor': mlp_reg.state_dict(),
        'mlp_classifier': mlp_cls.state_dict(),
        'ordinal_regressor': ord_reg.state_dict(),
        'scaler_mean': scaler.mean_,
        'scaler_scale': scaler.scale_,
        'feature_columns': FEATURE_COLUMNS
    }, os.path.join(model_dir, 'neural_network_models.pth'))

    print(f"✅ 模型已儲存: {os.path.join(model_dir, 'neural_network_models.pth')}")

    print("\n" + "="*80)
    print("✅ 實驗二完成！")
    print("="*80)

    return results


if __name__ == '__main__':
    main()
