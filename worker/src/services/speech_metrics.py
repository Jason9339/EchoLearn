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
        """DTW對齊，返回對齊路徑"""
        n, m = len(seq1), len(seq2)
        
        if seq1.ndim == 1:
            seq1 = seq1.reshape(-1, 1)
        if seq2.ndim == 1:
            seq2 = seq2.reshape(-1, 1)
        
        seq1 = np.nan_to_num(seq1)
        seq2 = np.nan_to_num(seq2)
        
        dtw_matrix = np.full((n + 1, m + 1), np.inf, dtype=float)
        dtw_matrix[0, 0] = 0.0
        
        window_size = max(abs(n - m), max(n, m) // 10)
        
        for i in range(1, n + 1):
            center = int(round(i * m / n))
            j_start = max(1, center - window_size)
            j_end = min(m + 1, center + window_size + 1)
            
            for j in range(j_start, j_end):
                cost = euclidean(seq1[i-1], seq2[j-1])
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i-1, j],
                    dtw_matrix[i, j-1],
                    dtw_matrix[i-1, j-1]
                )
        
        # 回溯路徑
        path = []
        i, j = n - 1, m - 1
        path.append((i, j))
        
        while i > 0 or j > 0:
            if i == 0:
                j -= 1
            elif j == 0:
                i -= 1
            else:
                candidates = [
                    (i-1, j-1, dtw_matrix[i, j]),
                    (i-1, j, dtw_matrix[i+1, j+1]),
                    (i, j-1, dtw_matrix[i+1, j])
                ]
                min_candidate = min(candidates, key=lambda x: x[2])
                i, j = min_candidate[0], min_candidate[1]
            path.append((i, j))
        
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
        計算VDE (濁音判斷錯誤率)
        
        Returns:
            float: VDE分數 (0-1, 越低越好)
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)
        
        vde_frames = np.logical_xor(aligned_feat1['voiced'], aligned_feat2['voiced'])
        return float(np.mean(vde_frames))
    
    def calculate_gpe(self, audio_ref: str, audio_test: str) -> float:
        """
        計算GPE (音高大誤差率) - 標準版本
        
        Returns:
            float: GPE分數 (0-1, 越低越好)
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)
        
        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test
        
        if not np.any(both):
            return 1.0
        
        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)
        
        if not np.any(mask):
            return 1.0
        
        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]
        
        abs_err = np.abs(f0_test - f0_ref)
        rel_err = abs_err / np.maximum(f0_ref, 1e-10)
        gross = (rel_err > 0.2) | (abs_err > self.gpe_threshold)
        
        return float(np.mean(gross))
    
    def calculate_gpe_log(self, audio_ref: str, audio_test: str, 
                         threshold_semitone: float = 3.0) -> float:
        """
        計算GPE (半音版本)
        
        Args:
            threshold_semitone: 半音閾值，預設3半音
            
        Returns:
            float: GPE_log分數 (0-1, 越低越好)
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)
        
        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test
        
        if not np.any(both):
            return 1.0
        
        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)
        
        if not np.any(mask):
            return 1.0
        
        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]
        
        dev_semitone = np.abs(np.log2(f0_test) - np.log2(f0_ref)) * 12.0
        
        return float(np.mean(dev_semitone > threshold_semitone))
    
    def calculate_gpe_offset(self, audio_ref: str, audio_test: str, 
                            threshold_semitone: float = 3.0) -> float:
        """
        計算GPE (補償全域音高位移的半音版本)
        
        Args:
            threshold_semitone: 半音閾值，預設3半音
            
        Returns:
            float: GPE_offset分數 (0-1, 越低越好)
        """
        feat1 = self.extract_features(audio_ref)
        feat2 = self.extract_features(audio_test)
        aligned_feat1, aligned_feat2 = self.align_features(feat1, feat2)
        
        voiced_ref = aligned_feat1['voiced']
        voiced_test = aligned_feat2['voiced']
        both = voiced_ref & voiced_test
        
        if not np.any(both):
            return 1.0
        
        f0_ref = aligned_feat1['f0'][both]
        f0_test = aligned_feat2['f0'][both]
        mask = (f0_ref > 0.0) & (f0_test > 0.0)
        
        if not np.any(mask):
            return 1.0
        
        f0_ref = f0_ref[mask]
        f0_test = f0_test[mask]
        
        log_ref = np.log2(f0_ref)
        log_test = np.log2(f0_test)
        offset = np.median(log_test - log_ref)
        
        dev_semitone = np.abs((log_test - log_ref) - offset) * 12.0
        
        return float(np.mean(dev_semitone > threshold_semitone))
    
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
        計算FFE (F0幀錯誤率)
        
        Returns:
            float: FFE分數 (0-1, 越低越好)
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
        
        return float(np.mean(ffe_errors))

