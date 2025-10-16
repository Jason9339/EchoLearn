'use client';

import { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import type { AudioPlayerProps } from '@/types/audio';

/**
 * Audio player component for playing recorded audio
 * Provides play/pause controls and visual feedback
 */
export default function AudioPlayer({
  audioUrl,
  isPlaying,
  onPlay,
  onPause,
  className = '',
  durationOverrideSeconds,
}: AudioPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Set up event listeners
      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        setIsLoading(false);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      const handleEnded = () => {
        setCurrentTime(0);
        onPause();
      };

      const handleLoadStart = () => {
        setIsLoading(true);
      };

      const handleError = () => {
        setIsLoading(false);
        console.error('Audio playback error');
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('error', handleError);
        audio.pause();
        audio.src = '';
      };
    }
  }, [audioUrl, onPause]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(error => {
        console.error('Failed to play audio:', error);
        onPause();
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, onPause]);

  // Format time helper
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const effectiveDuration = durationOverrideSeconds ? durationOverrideSeconds : duration;
  const progressPercentage = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (!audioUrl) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        <PlayIcon className="h-4 w-4" />
        <span className="text-sm">無音頻檔案</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        aria-label={isPlaying ? '暫停播放' : '播放音頻'}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="h-4 w-4 text-white" />
        ) : (
          <PlayIcon className="h-4 w-4 text-white ml-0.5" />
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Time Display */}
          <span className="text-xs text-gray-500 font-mono min-w-[2.5rem]">
            {formatTime(currentTime)}
          </span>

          {/* Progress Track */}
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 transition-all duration-100 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Duration Display */}
          <span className="text-xs text-gray-500 font-mono min-w-[2.5rem]">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
