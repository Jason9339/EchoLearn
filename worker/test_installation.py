#!/usr/bin/env python3
"""驗證音素相似度計算功能安裝"""

import sys

def check_import(module_name, package_name=None):
    """檢查套件是否可匯入"""
    package_name = package_name or module_name
    try:
        __import__(module_name)
        print(f"✅ {package_name:20s} - 已安裝")
        return True
    except ImportError:
        print(f"❌ {package_name:20s} - 未安裝")
        return False

def check_command(command, name):
    """檢查系統命令是否可用"""
    import subprocess
    try:
        subprocess.run([command, "-version"],
                      capture_output=True, check=True, timeout=5)
        print(f"✅ {name:20s} - 已安裝")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        print(f"❌ {name:20s} - 未安裝")
        return False

print("=" * 60)
print("音素相似度計算功能 - 安裝檢查")
print("=" * 60)

# 核心套件 (必須)
print("\n【核心套件】")
core_ok = all([
    check_import("torch", "torch"),
    check_import("torchaudio", "torchaudio"),
    check_import("transformers", "transformers"),
    check_import("librosa", "librosa"),
    check_import("soundfile", "soundfile"),
    check_import("numpy", "numpy"),
])

# 前處理套件 (強烈建議)
print("\n【前處理套件】")
preprocessing_ok = all([
    check_import("pyloudnorm", "pyloudnorm"),
    check_command("ffmpeg", "ffmpeg"),
])

# 降噪套件 (可選)
print("\n【降噪套件 (可選)】")
denoise_ok = check_import("df", "deepfilternet")

# GPU 檢查
print("\n【GPU 支援】")
try:
    import torch
    if torch.cuda.is_available():
        print(f"✅ CUDA 可用: {torch.cuda.get_device_name(0)}")
        gpu_ok = True
    else:
        print("⚠️  CUDA 不可用 (將使用 CPU，速度較慢)")
        gpu_ok = False
except:
    gpu_ok = False

# 測試匯入服務模組
print("\n【服務模組】")
try:
    from src.services.preprocessing import preprocess_pipeline
    print("✅ preprocessing       - 可匯入")
except ImportError as e:
    print(f"❌ preprocessing       - 無法匯入: {e}")

try:
    from src.services.phoneme_ctc import PhoneCTC
    print("✅ phoneme_ctc        - 可匯入")
except ImportError as e:
    print(f"❌ phoneme_ctc        - 無法匯入: {e}")

try:
    from src.services.phoneme_per import calculate_per_similarity
    print("✅ phoneme_per        - 可匯入")
except ImportError as e:
    print(f"❌ phoneme_per        - 無法匯入: {e}")

try:
    from src.services.phoneme_gop import calculate_gop_similarity
    print("✅ phoneme_gop        - 可匯入")
except ImportError as e:
    print(f"❌ phoneme_gop        - 無法匯入: {e}")

try:
    from src.services.phoneme_ppg import calculate_ppg_similarity
    print("✅ phoneme_ppg        - 可匯入")
except ImportError as e:
    print(f"❌ phoneme_ppg        - 無法匯入: {e}")

# 總結
print("\n" + "=" * 60)
print("安裝檢查總結")
print("=" * 60)

if core_ok:
    print("✅ 核心功能可用 - 可以使用音素相似度計算")
else:
    print("❌ 核心套件缺失 - 請安裝必須套件")
    sys.exit(1)

if preprocessing_ok:
    print("✅ 前處理功能完整 - 可使用進階前處理")
else:
    print("⚠️  前處理功能不完整 - 建議安裝 pyloudnorm 和 ffmpeg")

if denoise_ok:
    print("✅ 降噪功能可用")
else:
    print("ℹ️  降噪功能不可用 (可選)")

if gpu_ok:
    print("✅ GPU 加速可用 - 計算速度最佳")
else:
    print("⚠️  使用 CPU 計算 - 速度較慢但功能正常")

print("\n如果所有核心套件都已安裝，可以開始使用！")
print("參考文檔: PHONEME_SIMILARITY_USAGE.md")
