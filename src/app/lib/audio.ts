/**
 * Audio utility functions
 * @file lib/audio.ts
 */

/**
 * Format time in seconds to MM:SS format
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if browser supports audio recording
 * @returns True if MediaRecorder is supported
 */
export function isAudioRecordingSupported(): boolean {
  return typeof window !== 'undefined' && 
         'MediaRecorder' in window && 
         'getUserMedia' in navigator.mediaDevices;
}

/**
 * Get supported MIME types for audio recording
 * @returns Array of supported MIME types
 */
export function getSupportedAudioMimeTypes(): string[] {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];

  return types.filter(type => {
    return MediaRecorder.isTypeSupported(type);
  });
}

/**
 * Get optimal audio recording settings
 * @returns Audio constraints object
 */
export function getOptimalAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1, // Mono recording to reduce file size
    },
  };
}

/**
 * Validate audio file
 * @param file - File to validate
 * @param maxSizeBytes - Maximum file size in bytes (default: 500KB)
 * @returns Validation result
 */
export function validateAudioFile(file: File, maxSizeBytes: number = 500 * 1024): {
  isValid: boolean;
  error?: string;
} {
  // Check file type
  const allowedTypes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: '不支援的音頻格式',
    };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `檔案大小超過限制 (${formatFileSize(maxSizeBytes)})`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      isValid: false,
      error: '檔案為空',
    };
  }

  return { isValid: true };
}

/**
 * Generate unique filename for audio recording
 * @param userId - User ID
 * @param sentenceId - Sentence ID
 * @param slotIndex - Slot index (0, 1, 2)
 * @returns Unique filename
 */
export function generateAudioFilename(
  userId: string,
  sentenceId: number,
  slotIndex: number
): string {
  const timestamp = Date.now();
  return `${userId}_${sentenceId}_${slotIndex}_${timestamp}.webm`;
}

/**
 * Get error message for audio recording errors
 * @param error - Error object or error name
 * @returns User-friendly error message
 */
export function getAudioErrorMessage(error: Error | string): string {
  const errorName = typeof error === 'string' ? error : error.name;
  
  switch (errorName) {
    case 'NotAllowedError':
      return '麥克風權限被拒絕，請允許麥克風存取';
    case 'NotFoundError':
      return '找不到麥克風設備，請檢查您的音頻設備';
    case 'NotSupportedError':
      return '您的瀏覽器不支援音頻錄製功能';
    case 'NotReadableError':
      return '麥克風設備被其他應用程式使用中';
    case 'OverconstrainedError':
      return '無法滿足音頻錄製要求';
    case 'SecurityError':
      return '安全限制阻止了麥克風存取';
    case 'PERMISSION_DENIED':
      return '需要麥克風權限才能錄音';
    case 'NO_MICROPHONE':
      return '找不到麥克風設備';
    case 'NOT_SUPPORTED':
      return '瀏覽器不支援錄音功能';
    case 'RECORDING_ERROR':
      return '錄音過程中發生錯誤';
    case 'PLAYBACK_ERROR':
      return '播放音頻時發生錯誤';
    case 'UPLOAD_FAILED':
      return '上傳失敗，請檢查網路連線';
    case 'PLAY_FIRST':
      return '請先播放原音';
    default:
      return '發生未知錯誤，請重試';
  }
}

/**
 * Calculate recording quality score based on duration and file size
 * @param duration - Recording duration in milliseconds
 * @param fileSize - File size in bytes
 * @returns Quality score (0-100)
 */
export function calculateRecordingQuality(duration: number, fileSize: number): number {
  const durationSeconds = duration / 1000;
  
  // Ideal file size is around 50KB per second
  const idealFileSize = durationSeconds * 50 * 1024;
  const sizeRatio = Math.min(fileSize / idealFileSize, 2); // Cap at 2x ideal
  
  // Quality decreases if file is too large or too small
  const sizeScore = Math.max(0, 100 - (sizeRatio - 1) * 50);
  
  // Minimum duration should be at least 1 second
  const durationScore = Math.min(100, durationSeconds * 20);
  
  return Math.round((sizeScore + durationScore) / 2);
}
