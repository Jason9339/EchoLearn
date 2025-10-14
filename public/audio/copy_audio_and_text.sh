grep -f text_patterns ../../../cmu_us_bdl_arctic/etc/txt.done.data > saying.txt

DEST_DIR="cmu_us_bdl_arctic"

mkdir -p "$DEST_DIR"

SRC_DIR='../../../cmu_us_bdl_arctic/wav' 

cat text_patterns \
| awk -v src_dir="$SRC_DIR" '{print src_dir "/" $1 ".wav"}' \
| xargs -I {} cp "{}" "$DEST_DIR"

DEST_DIR="cmu_us_clb_arctic"
mkdir -p "$DEST_DIR"

SRC_DIR='../../../cmu_us_clb_arctic/wav' 

cat text_patterns \
| awk -v src_dir="$SRC_DIR" '{print src_dir "/" $1 ".wav"}' \
| xargs -I {} cp "{}" "$DEST_DIR"

