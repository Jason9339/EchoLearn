#!/bin/bash
# 音素相似度計算功能 - 安裝腳本

set -e

echo "=========================================="
echo "音素相似度計算功能 - 安裝"
echo "=========================================="

# 檢查 Python
python3 --version || { echo "錯誤: 需要 Python 3.10+"; exit 1; }

# 檢測 GPU
if command -v nvidia-smi &> /dev/null; then
    echo "✅ 檢測到 NVIDIA GPU"
    PYTORCH_INDEX="https://download.pytorch.org/whl/cu121"
else
    echo "⚠️  未檢測到 GPU，安裝 CPU 版本"
    PYTORCH_INDEX="https://download.pytorch.org/whl/cpu"
fi

# 安裝系統依賴
echo -e "\n[1/4] 安裝系統依賴..."
if command -v espeak-ng &> /dev/null; then
    echo "✅ espeak-ng 已安裝"
else
    echo "正在安裝 espeak-ng..."
    sudo apt-get update && sudo apt-get install -y espeak-ng || echo "⚠️  請手動安裝 espeak-ng"
fi

if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg 已安裝"
else
    echo "正在安裝 ffmpeg..."
    sudo apt-get update && sudo apt-get install -y ffmpeg || echo "⚠️  請手動安裝 ffmpeg"
fi

# 安裝 PyTorch
echo -e "\n[2/4] 安裝 PyTorch..."
pip install torch torchaudio --index-url $PYTORCH_INDEX

# 安裝其他依賴
echo -e "\n[3/4] 安裝其他套件..."
pip install -r requirements.txt

# 驗證 espeak-ng
echo -e "\n[4/4] 驗證 espeak-ng..."
espeak-ng --version || echo "⚠️  espeak-ng 安裝失敗，音素辨識功能可能無法使用"

# 驗證
echo -e "\n驗證安裝..."
python3 test_installation.py

echo -e "\n✅ 安裝完成！請參考 README_PHONEME.md 開始使用"
