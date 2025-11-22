'use client';

import { CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import AudioPlayer from '@/components/AudioPlayer';
import type { RecordingButtonProps, ButtonState } from '@/types/audio';
import { MAX_RECORDING_DURATION_MS } from '@/types/audio';
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
  onUploadRecording,
  onDeleteRecording,
  disabled = false,
  hasPlayedOriginal = false,
  showDetails = true,
}: RecordingButtonProps) {
  const hasRecording = Boolean(recordingState.audioBlob || recordingState.audioUrl);

  // Check if this slot can start recording
  const canStartRecording =
    hasPlayedOriginal &&
    !recordingState.isRecording &&
    !recordingState.isUploading &&
    !recordingState.isDeleting &&
    !hasRecording;

  const getButtonState = (): ButtonState => {
    if (disabled || recordingState.isDeleting) return 'disabled';
    if (recordingState.isUploading) return 'uploading';
    if (recordingState.isRecording) return 'recording';
    if (hasRecording) return 'recorded';
    if (canStartRecording) return 'ready';
    return 'idle';
  };

  // Check if recording has been uploaded (has URL but no blob)
  const isUploaded = recordingState.audioUrl && !recordingState.audioBlob;

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
        return <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-white" />;
      case 'recorded':
        if (isUploaded) {
          return (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          );
        }
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'uploading':
        return (
          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white" />;
    }
  };

  const handleClick = () => {
    if (disabled || recordingState.isDeleting) return;
    
    const state = getButtonState();
    
    // Debug logging
    // console.log('RecordingButton click:', {
    //   slotIndex,
    //   sentenceId,
    //   state,
    //   canStartRecording,
    //   hasPlayedOriginal,
    //   recordingState: {
    //     isRecording: recordingState.isRecording,
    //     audioBlob: !!recordingState.audioBlob,
    //     audioUrl: !!recordingState.audioUrl,
    //     isUploading: recordingState.isUploading,
    //     error: recordingState.error
    //   }
    // });
    
    switch (state) {
      case 'idle':
      case 'ready':
        // console.log('Calling onStartRecording...');
        onStartRecording();
        break;
      case 'recording':
        // console.log('Calling onStopRecording...');
        onStopRecording();
        break;
      case 'recorded':
        // console.log('Calling onStartRecording for re-record...');
        onStartRecording(); // Start new recording to replace existing one
        break;
      case 'uploading':
        // Do nothing during upload
        break;
    }
  };

  const isPlaying = false; // This would be managed by parent component
  const buttonState = getButtonState();
  const displayFileSize =
    recordingState.audioBlob?.size ?? recordingState.fileSize ?? null;
  const showUploadSuccess =
    !recordingState.audioBlob &&
    !!recordingState.audioUrl &&
    !recordingState.isUploading &&
    !recordingState.isDeleting;

  const handleUploadClick = () => {
    if (
      !onUploadRecording ||
      recordingState.isUploading ||
      recordingState.isDeleting ||
      !recordingState.audioBlob
    ) {
      return;
    }
    onUploadRecording();
  };

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Circular Recording Button */}
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={
            disabled ||
            recordingState.isDeleting ||
            (recordingState.isUploading && !recordingState.isRecording)
          }
          className={`
            relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
            transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-opacity-50
            ${buttonState === 'recording'
              ? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-300 text-white shadow-lg shadow-rose-500/20'
              : buttonState === 'recorded'
              ? isUploaded
                ? 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-white border border-slate-200 hover:bg-slate-50 focus:ring-slate-300 text-slate-600 shadow-sm'
              : buttonState === 'uploading'
              ? 'bg-white border border-slate-200 hover:bg-slate-50 focus:ring-slate-300 text-slate-600 shadow-sm'
              : buttonState === 'ready'
              ? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-300 text-white shadow-lg shadow-rose-500/20'
              : buttonState === 'disabled'
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-slate-100 hover:bg-slate-200 focus:ring-slate-300 text-slate-700'
            }
          `}
          aria-label={getButtonText()}
        >
          {/* Animated Background Ring for Recording State */}
          {buttonState === 'recording' && (
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

        {/* Warning Message Overlay - Only show if not recording and not ready */}
        {recordingState.error === 'PLAY_FIRST' && buttonState !== 'recording' && buttonState !== 'ready' && (
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
        {buttonState === 'recording' && (
          <div className="absolute inset-0 rounded-full pointer-events-none">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 transform -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="white"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - Math.min(recordingState.duration / MAX_RECORDING_DURATION_MS, 1))}`}
                className="transition-all duration-100 ease-out"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Recording Duration Display */}
      {!showDetails && recordingState.isRecording && (
        <div className="text-center">
          <div className="text-xs sm:text-sm font-medium text-slate-700 tabular-nums">
            {(recordingState.duration / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {showDetails && (
        <>
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
        </>
      )}

      {/* Error Display - Only show non-PLAY_FIRST errors */}
      {recordingState.error && recordingState.error !== 'PLAY_FIRST' && (
        <div className="text-xs text-red-600 text-center max-w-32">
          ❌ {getAudioErrorMessage(recordingState.error)}
        </div>
      )}

      {/* Audio Player and Upload Button Row */}
      {showDetails && hasRecording && !recordingState.isRecording && (
        <div className="w-full max-w-48 flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <AudioPlayer
              audioUrl={recordingState.audioUrl}
              isPlaying={isPlaying}
              onPlay={onPlayRecording}
              onPause={() => {}}
              className="text-xs"
            />
            {onUploadRecording && (
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={
                  recordingState.isUploading ||
                  recordingState.isDeleting ||
                  !recordingState.audioBlob
                }
                className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded transition-colors ${
                  recordingState.isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : recordingState.audioBlob
                      ? 'bg-[#476EAE] hover:bg-[#5A85C9] text-white'
                      : showUploadSuccess
                        ? 'bg-[#A7E399] text-gray-800 cursor-default'
                        : 'bg-[#476EAE] text-white cursor-default'
                }`}
              >
                {recordingState.isUploading ? (
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : recordingState.audioBlob ? (
                  <>
                    <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>上傳錄音</span>
                  </>
                ) : showUploadSuccess ? (
                  <>
                    <CheckCircleIcon className="h-3 w-3" />
                    <span>上傳成功</span>
                  </>
                ) : (
                  <span>上傳錄音</span>
                )}
              </button>
            )}
            {onDeleteRecording && (
              <button
                type="button"
                onClick={onDeleteRecording}
                disabled={recordingState.isDeleting || recordingState.isUploading}
                className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded border transition-colors ${
                  recordingState.isDeleting || recordingState.isUploading
                    ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-100'
                    : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
              >
                {recordingState.isDeleting ? (
                  <>
                    <svg
                      className="h-3 w-3 animate-spin text-red-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>刪除中...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-3 w-3" />
                    <span>刪除錄音</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Recording Info */}
          <div className="text-xs text-gray-500 text-center">
            <div>時長: {(recordingState.duration / 1000).toFixed(1)}s</div>
            {displayFileSize !== null && (
              <div>大小: {(displayFileSize / 1024).toFixed(1)}KB</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
