'use client';

import { useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import AudioPlayer from '@/components/AudioPlayer';

/**
 * Test page for audio recording functionality
 * This is a temporary page to test the useAudioRecorder hook and AudioPlayer component
 */
export default function AudioTestPage() {
  const { recordingState, startRecording, stopRecording, playRecording, clearRecording } = useAudioRecorder();
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    playRecording();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const getButtonState = (): string => {
    if (recordingState.isRecording) return 'recording';
    if (recordingState.audioBlob) return 'recorded';
    return 'idle';
  };

  const getButtonText = (): string => {
    if (recordingState.isRecording) {
      const remainingSeconds = Math.max(0, 10 - Math.floor(recordingState.duration / 1000));
      return `錄音中... ${remainingSeconds}s`;
    }
    if (recordingState.audioBlob) return '重新錄音';
    return '開始錄音';
  };

  const getButtonStyle = (): string => {
    const baseStyle = 'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition';
    
    switch (getButtonState()) {
      case 'recording':
        return `${baseStyle} bg-red-500 text-white hover:bg-red-600`;
      case 'recorded':
        return `${baseStyle} bg-green-500 text-white hover:bg-green-600`;
      default:
        return `${baseStyle} bg-gray-100 text-gray-700 hover:bg-gray-200`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">音頻錄音測試</h1>
        
        {/* Recording Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">錄音控制</h2>
          
          <div className="space-y-4">
            {/* Record Button */}
            <button
              type="button"
              onClick={recordingState.isRecording ? stopRecording : startRecording}
              className={getButtonStyle()}
              disabled={recordingState.isUploading}
            >
              {recordingState.isRecording ? (
                <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
              ) : (
                <div className="w-4 h-4 bg-current rounded-full" />
              )}
              {getButtonText()}
            </button>

            {/* Clear Button */}
            {recordingState.audioBlob && (
              <button
                type="button"
                onClick={clearRecording}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                清除錄音
              </button>
            )}
          </div>

          {/* Status Display */}
          <div className="mt-4 space-y-2">
            <div className="text-sm text-gray-600">
              <strong>狀態:</strong> {getButtonState()}
            </div>
            <div className="text-sm text-gray-600">
              <strong>時長:</strong> {(recordingState.duration / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">
              <strong>檔案大小:</strong> {recordingState.audioBlob ? `${(recordingState.audioBlob.size / 1024).toFixed(1)}KB` : 'N/A'}
            </div>
          </div>

          {/* Error Display */}
          {recordingState.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-600">
                <strong>錯誤:</strong> {
                  recordingState.error === 'PERMISSION_DENIED' ? '麥克風權限被拒絕' :
                  recordingState.error === 'NO_MICROPHONE' ? '找不到麥克風設備' :
                  recordingState.error === 'NOT_SUPPORTED' ? '瀏覽器不支援錄音功能' :
                  recordingState.error === 'RECORDING_ERROR' ? '錄音過程中發生錯誤' :
                  recordingState.error === 'PLAYBACK_ERROR' ? '播放音頻時發生錯誤' :
                  recordingState.error === 'UPLOAD_FAILED' ? '上傳失敗' :
                  '未知錯誤'
                }
              </div>
            </div>
          )}
        </div>

        {/* Audio Player */}
        {recordingState.audioBlob && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">音頻播放器</h2>
            <AudioPlayer
              audioUrl={recordingState.audioUrl}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
            />
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">使用說明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 點擊「開始錄音」按鈕開始錄音</li>
            <li>• 錄音會自動在 10 秒後停止</li>
            <li>• 也可以手動點擊「停止錄音」按鈕</li>
            <li>• 錄音完成後可以使用播放器播放</li>
            <li>• 點擊「清除錄音」可以重新開始</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
