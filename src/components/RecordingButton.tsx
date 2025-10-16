'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import AudioPlayer from '@/components/AudioPlayer';
import type { RecordingButtonProps, ButtonState } from '@/types/audio';
import { getAudioErrorMessage } from '@/app/lib/audio';

/**
 * Circular recording button component with animated background
 * Click to start recording, click again to stop recording
 */
export default function RecordingButton({
  slotIndex,
  sentenceId,
  recordingState,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  disabled = false,
  hasPlayedOriginal = false,
}: RecordingButtonProps) {
  // Check if this slot can start recording
  const canStartRecording = hasPlayedOriginal && !recordingState.audioBlob && !recordingState.isRecording && !recordingState.isUploading;

  const getButtonState = (): ButtonState => {
    if (disabled) return 'disabled';
    if (recordingState.isUploading) return 'uploading';
    if (recordingState.isRecording) return 'recording';
    if (recordingState.audioBlob) return 'recorded';
    if (canStartRecording) return 'ready';
    return 'idle';
  };

  const getButtonText = (): string => {
    const state = getButtonState();
    
    switch (state) {
      case 'recording':
        return '停止錄音';
      case 'recorded':
        return '重新錄音';
      case 'uploading':
        return '上傳中';
      case 'disabled':
        return '錄音';
      case 'ready':
        return '開始錄音';
      default:
        return '開始錄音';
    }
  };

  const getIcon = () => {
    const state = getButtonState();
    
    switch (state) {
      case 'recording':
        return <StopIcon className="h-6 w-6" />;
      case 'uploading':
        return (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <MicrophoneIcon className="h-6 w-6" />;
    }
  };

  const handleClick = () => {
    if (disabled) return;
    
    const state = getButtonState();
    
    // Debug logging
    console.log('RecordingButton click:', {
      slotIndex,
      sentenceId,
      state,
      canStartRecording,
      hasPlayedOriginal,
      recordingState: {
        isRecording: recordingState.isRecording,
        audioBlob: !!recordingState.audioBlob,
        isUploading: recordingState.isUploading,
        error: recordingState.error
      }
    });
    
    switch (state) {
      case 'idle':
      case 'ready':
        console.log('Calling onStartRecording...');
        onStartRecording();
        break;
      case 'recording':
        console.log('Calling onStopRecording...');
        onStopRecording();
        break;
      case 'recorded':
        console.log('Calling onStartRecording for re-record...');
        onStartRecording(); // Start new recording to replace existing one
        break;
      case 'uploading':
        // Do nothing during upload
        break;
    }
  };

  const isPlaying = false; // This would be managed by parent component

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Circular Recording Button */}
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || (recordingState.isUploading && !recordingState.isRecording)}
          className={`
            relative w-16 h-16 rounded-full flex items-center justify-center
            transition-all duration-300 ease-in-out transform hover:scale-105
            focus:outline-none focus:ring-4 focus:ring-opacity-50
            ${getButtonState() === 'recording' 
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300 text-white' 
              : getButtonState() === 'recorded'
              ? 'bg-green-500 hover:bg-green-600 focus:ring-green-300 text-white'
              : getButtonState() === 'uploading'
              ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300 text-white'
              : getButtonState() === 'ready'
              ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300 text-white'
              : getButtonState() === 'disabled'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gray-100 hover:bg-gray-200 focus:ring-gray-300 text-gray-700'
            }
            shadow-lg hover:shadow-xl
          `}
          aria-label={getButtonText()}
        >
          {/* Animated Background Ring for Recording State */}
          {getButtonState() === 'recording' && (
            <div className="absolute inset-0 rounded-full pointer-events-none">
              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-75"></div>
              <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse"></div>
            </div>
          )}
          
          {/* Button Content */}
          <div className="relative z-10">
            {getIcon()}
          </div>
        </button>

        {/* Message Overlay - Priority Order: recording > ready > error */}
        {getButtonState() === 'recording' && (
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-red-500 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap animate-pulse">
              <div className="flex items-center gap-1">
                <span>🎤</span>
                <span>正在錄音中...</span>
              </div>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-500"></div>
              </div>
            </div>
          </div>
        )}

        {/* Ready to Record Message Overlay - Only show if not recording */}
        {getButtonState() === 'ready' && getButtonState() !== 'recording' && (
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap animate-pulse">
              <div className="flex items-center gap-1">
                <span>✨</span>
                <span>可以開始錄音</span>
              </div>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Message Overlay - Only show if not recording and not ready */}
        {recordingState.error === 'PLAY_FIRST' && getButtonState() !== 'recording' && getButtonState() !== 'ready' && (
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-red-500 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap animate-pulse">
              <div className="flex items-center gap-1">
                <span>!</span>
                <span>請先播放原音 !</span>
              </div>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-500"></div>
              </div>
            </div>
          </div>
        )}

        {/* Recording Progress Ring */}
        {getButtonState() === 'recording' && (
          <div className="absolute inset-0 rounded-full pointer-events-none">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="white"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(recordingState.duration / 10000, 1))}`}
                className="transition-all duration-100 ease-out"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Button Label */}
      <div className="text-center">
        <div className="text-sm font-medium text-gray-700">
          {getButtonText()}
        </div>
      </div>

      {/* Upload Status */}
      {recordingState.isUploading && (
        <div className="text-xs text-blue-600 font-medium">
          ⬆️ 上傳中...
        </div>
      )}

      {/* Error Display - Only show non-PLAY_FIRST errors */}
      {recordingState.error && recordingState.error !== 'PLAY_FIRST' && (
        <div className="text-xs text-red-600 text-center max-w-32">
          ❌ {getAudioErrorMessage(recordingState.error)}
        </div>
      )}

      {/* Audio Player */}
      {recordingState.audioBlob && !recordingState.isRecording && (
        <div className="w-full max-w-48">
          <AudioPlayer
            audioUrl={recordingState.audioUrl}
            isPlaying={isPlaying}
            onPlay={onPlayRecording}
            onPause={() => {}} // This would be handled by parent
            className="text-xs"
          />
        </div>
      )}

      {/* Recording Info */}
      {recordingState.audioBlob && !recordingState.isRecording && (
        <div className="text-xs text-gray-500 text-center">
          <div>時長: {(recordingState.duration / 1000).toFixed(1)}s</div>
          <div>大小: {(recordingState.audioBlob.size / 1024).toFixed(1)}KB</div>
        </div>
      )}
    </div>
  );
}
