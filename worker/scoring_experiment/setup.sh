#!/bin/bash
# 設定評分實驗環境

set -e

echo "================================================"
echo "設定評分實驗環境"
echo "================================================"

# 檢查是否在 worker/scoring_experiment 目錄
if [ ! -f "requirements.txt" ]; then
    echo "錯誤：請在 worker/scoring_experiment/ 目錄下執行此腳本"
    exit 1
fi

# 建立虛擬環境（如果不存在）
if [ ! -d ".venv" ]; then
    echo "建立虛擬環境..."
    python3 -m venv .venv
fi

# 啟動虛擬環境
echo "啟動虛擬環境..."
source .venv/bin/activate

# 升級 pip
echo "升級 pip..."
pip install --upgrade pip setuptools wheel

# 安裝依賴
echo "安裝依賴套件..."
pip install -r requirements.txt

# 儲存 freeze
echo "儲存 requirements.lock..."
pip freeze > requirements.lock

echo ""
echo "✅ 環境設定完成！"
echo ""
echo "使用方式："
echo "  source .venv/bin/activate  # 啟動虛擬環境"
echo "  python scripts/xxx.py      # 執行腳本"
echo "  deactivate                  # 離開虛擬環境"
echo ""
