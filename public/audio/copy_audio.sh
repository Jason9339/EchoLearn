# 設定目標資料夾（在你當前執行的位置）
DEST_DIR="cmu_us_bdl_arctic"
mkdir -p "$DEST_DIR"

# 設定來源資料夾
SRC_DIR='../../../cmu_us_bdl_arctic/wav' 

# 讀取模式，加上路徑和副檔名
cat text_patterns \
| awk -v src_dir="$SRC_DIR" '{print src_dir "/" $1 ".wav"}' \
| xargs -I {} cp "{}" "$DEST_DIR"
