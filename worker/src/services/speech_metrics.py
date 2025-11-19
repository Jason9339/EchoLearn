import numpy as np
import parselmouth
from scipy.spatial.distance import euclidean
from typing import Tuple, List
import warnings
warnings.filterwarnings('ignore')


class SpeechMetrics:
    """語音評估指標計算器 - 只返回分數"""
    
    def __init__(self, frame_shift=0.010):
        self.frame_shift = frame_shift
        self.gpe_threshold = 20  # Hz
    
    # ==================== 特徵提取 ====================
    def extract_features(self, audio_path: str) -> dict:
        """提取語音特徵"""
        sound = parselmouth.Sound(audio_path)
        
        # F0
        pitch = sound.to_pitch(
            time_step=self.frame_shift,
            pitch_floor=75.0,
            pitch_ceiling=600.0
        )
        f0_values, time_points = [], []
        for i in range(pitch.n_frames):
            t = pitch.get_time_from_frame_number(i + 1)
            f0 = pitch.get_value_at_time(t)
            f0_values.append(f0 if f0 is not None and not np.isnan(f0) else 0.0)
            time_points.append(t)
        f0_values = np.nan_to_num(np.array(f0_values, dtype=float))
        
        # Intensity
        intensity = sound.to_intensity(time_step=self.frame_shift, minimum_pitch=75.0)
        intensity_values = []
        for t in time_points:
            v = intensity.get_value(t)
            intensity_values.append(v if v is not None else 0.0)
        intensity_values = np.nan_to_num(np.array(intensity_values, dtype=float))
        
        # Voiced
        voiced = (f0_values > 0.0) & (intensity_values > 30.0)
        
        return {
            'f0': f0_values,
            'intensity': intensity_values,
            'voiced': voiced
        }
    
    # ==================== DTW 對齊 ====================
    def dtw_alignment(self, seq1: np.ndarray, seq2: np.ndarray) -> List[Tuple[int, int]]:
        """DTW對齊，返回對齊路徑（修正版：正確的回溯索引）"""
        n, m = len(seq1), len(seq2)

        if seq1.ndim == 1:
            seq1 = seq1.reshape(-1, 1)
        if seq2.ndim == 1:
            seq2 = seq2.reshape(-1, 1)

        seq1 = np.nan_to_num(seq1)
        seq2 = np.nan_to_num(seq2)

        # Sakoe-Chiba band constraint
        band = max(abs(n - m), max(n, m) // 10)

        dtw = np.full((n + 1, m + 1), np.inf, dtype=float)
        dtw[0, 0] = 0.0

        # 前向計算
        for i in range(1, n + 1):
            j_start = max(1, i - band)
            j_end = min(m, i + band)

            for j in range(j_start, j_end + 1):
                cost = euclidean(seq1[i - 1], seq2[j - 1])
                dtw[i, j] = cost + min(
                    dtw[i - 1, j],      # 插入
                    dtw[i, j - 1],      # 刪除
                    dtw[i - 1, j - 1]   # 匹配
                )

        # 正確的回溯：從 (n, m) 開始
        path = []
        i, j = n, m

        while i > 0 and j > 0:
            path.append((i - 1, j - 1))  # 對齊到原序列索引（0-based）

            # 選擇最小代價的前驅
            candidates = [dtw[i - 1, j - 1], dtw[i - 1, j], dtw[i, j - 1]]
            step = np.argmin(candidates)

            if step == 0:      # 匹配
                i -= 1
                j -= 1
            elif step == 1:    # 插入（seq1 前進）
                i -= 1
            else:              # 刪除（seq2 前進）
                j -= 1

        # 處理邊界情況
        while i > 0:
            path.append((i - 1, 0))
            i -= 1
        while j > 0:
            path.append((0, j - 1))
            j -= 1

        path.reverse()
        return path
    
    def align_features(self, feat1: dict, feat2: dict) -> Tuple[dict, dict]:
        """使用DTW對齊特徵"""
        def _safe_norm(x):
            x = np.nan_to_num(x)
            denom = max(np.max(np.abs(x)), 1e-6)
            return x / denom
        
        combined1 = np.column_stack([
            _safe_norm(feat1['f0']),
            _safe_norm(feat1['intensity']),
            feat1['voiced'].astype(float)
        ])
        combined2 = np.column_stack([
            _safe_norm(feat2['f0']),
            _safe_norm(feat2['intensity']),
            feat2['voiced'].astype(float)
        ])
        
        path = self.dtw_alignment(combined1, combined2)
        
        aligned_indices1 = [p[0] for p in path]
        aligned_indices2 = [p[1] for p in path]
        
        aligned_feat1 = {
            'f0': feat1['f0'][aligned_indices1],
            'intensity': feat1['intensity'][aligned_indices1],
            'voiced': feat1['voiced'][aligned_indices1]
        }
        aligned_feat2 = {
            'f0': feat2['f0'][aligned_indices2],
            'intensity': feat2['intensity'][aligned_indices2],
            'voiced': feat2['voiced'][aligned_indices2]
        }
        
        return aligned_feat1, aligned_feat2
    
    # ==================== 評估指標函數 ====================

    def calculate_vde(self, audio_ref: str, audio_test: str) -> float:
        """
        計算 VDE Similarity (濁音判斷相似度)

        Returns:
            float: VDE 相似度分數 (0-1, 越高越好)
                   1.0 = 濁音判斷完全一致
                   0.0 = 濁音判斷完全不同
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)

        vde_frames = np.logical_xor(aligned_feat1['voiced'], aligned_feat2['voiced'])
        vde_error_rate = float(np.mean(vde_frames))

        # 轉換為相似度：1 - 錯誤率
        return 1.0 - vde_error_rate
    
    def calculate_gpe(self, audio_ref: str, audio_test: str) -> float:
        """
        計算 GPE Similarity (音高相似度) - 標準版本

        Returns:
            float: GPE 相似度分數 (0-1, 越高越好)
                   1.0 = 音高完全一致（無大誤差）
                   0.0 = 音高完全不同（全部大誤差）
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)

        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test

        if not np.any(both):
            return 0.0  # 無共同濁音段 = 完全不同

        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)

        if not np.any(mask):
            return 0.0

        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]

        abs_err = np.abs(f0_test - f0_ref)
        rel_err = abs_err / np.maximum(f0_ref, 1e-10)
        gross = (rel_err > 0.2) | (abs_err > self.gpe_threshold)

        gpe_error_rate = float(np.mean(gross))

        # 轉換為相似度：1 - 錯誤率
        return 1.0 - gpe_error_rate
    
    def calculate_gpe_log(self, audio_ref: str, audio_test: str,
                         threshold_semitone: float = 3.0) -> float:
        """
        計算 GPE_log Similarity (音高相似度 - 半音版本)

        Args:
            threshold_semitone: 半音閾值，預設3半音

        Returns:
            float: GPE_log 相似度分數 (0-1, 越高越好)
                   1.0 = 音高偏差都在閾值內
                   0.0 = 音高偏差都超過閾值
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)

        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test

        if not np.any(both):
            return 0.0

        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)

        if not np.any(mask):
            return 0.0

        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]

        dev_semitone = np.abs(np.log2(f0_test) - np.log2(f0_ref)) * 12.0

        gpe_log_error_rate = float(np.mean(dev_semitone > threshold_semitone))

        # 轉換為相似度：1 - 錯誤率
        return 1.0 - gpe_log_error_rate
    
    def calculate_gpe_offset(self, audio_ref: str, audio_test: str,
                            threshold_semitone: float = 3.0) -> float:
        """
        計算 GPE_offset Similarity (音高相似度 - 補償全域音高位移)

        Args:
            threshold_semitone: 半音閾值，預設3半音

        Returns:
            float: GPE_offset 相似度分數 (0-1, 越高越好)
                   1.0 = 音高輪廓一致（補償整體音高差異後）
                   0.0 = 音高輪廓完全不同
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)

        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test

        if not np.any(both):
            return 0.0

        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)

        if not np.any(mask):
            return 0.0

        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]

        log_ref = np.log2(f0_ref)
        log_test = np.log2(f0_test)
        offset = np.median(log_test - log_ref)

        dev_semitone = np.abs((log_test - log_ref) - offset) * 12.0

        gpe_offset_error_rate = float(np.mean(dev_semitone > threshold_semitone))

        # 轉換為相似度：1 - 錯誤率
        return 1.0 - gpe_offset_error_rate
    
    def calculate_energy_similarity(self, audio_ref: str, audio_test: str) -> float:
        """
        計算能量相似度
        
        Returns:
            float: 能量相似度分數 (0-1, 越高越好)
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)
        
        intensity1 = aligned_feat1['intensity']
        intensity2 = aligned_feat2['intensity']
        
        corr = np.corrcoef(intensity1, intensity2)[0, 1]
        
        if np.isnan(corr):
            return 0.0
        
        return float((corr + 1.0) / 2.0)
    
    def calculate_ffe(self, audio_ref: str, audio_test: str) -> float:
        """
        計算 FFE Similarity (F0 幀相似度)

        Returns:
            float: FFE 相似度分數 (0-1, 越高越好)
                   1.0 = 所有幀的 F0 都正確（無 VDE 也無 GPE 錯誤）
                   0.0 = 所有幀的 F0 都錯誤
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)

        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']

        # VDE errors
        vde_errors = np.logical_xor(voiced_ref, voiced_test)

        # GPE errors
        both = voiced_ref & voiced_test
        gpe_errors = np.zeros_like(voiced_ref, dtype=bool)

        if np.any(both):
            f0_ref = aligned_feat1['f0'][both]
            f0_test = aligned_feat2['f0'][both]
            rel_err = np.abs(f0_test - f0_ref) / np.maximum(f0_ref, 1e-10)
            gross_mask = (rel_err > 0.2) | (np.abs(f0_test - f0_ref) > self.gpe_threshold)
            gpe_errors[both] = gross_mask

        ffe_errors = vde_errors | gpe_errors

        ffe_error_rate = float(np.mean(ffe_errors))

        # 轉換為相似度：1 - 錯誤率
        return 1.0 - ffe_error_rate

