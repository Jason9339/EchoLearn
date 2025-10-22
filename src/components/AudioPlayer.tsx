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
}: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Set up event listeners
      const handleLoadedMetadata = () => {
        setIsLoading(false);
      };

      const handleEnded = () => {
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
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
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

  if (!audioUrl) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        <PlayIcon className="h-4 w-4" />
        <span className="text-sm">無音頻檔案</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-white border-2 border-[#41A67E] hover:border-[#56BF94] disabled:border-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
        aria-label={isPlaying ? '暫停播放' : '播放音頻'}
      >
        {isLoading ? (
          <div className="w-3 h-3 border-2 border-[#41A67E] border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="h-3 w-3 text-[#41A67E]" />
        ) : (
          <PlayIcon className="h-3 w-3 text-[#41A67E] ml-0.5" />
        )}
      </button>
    </div>
  );
}
