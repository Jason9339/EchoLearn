'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import AudioPlayer from '@/components/AudioPlayer';
import { practiceSentences } from '@/app/lib/placeholder-data';

interface Recording {
  id: string;
  courseId: string;
  sentenceId: number;
  slotIndex: number;
  audioUrl: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  myRating: number | null;
}

/**
 * PeerReviewRatingBar - Rating component for peer review
 * Doesn't submit to API directly, uses parent callback instead
 */
function PeerReviewRatingBar({
  isLocked,
  initialRating = null,
  onRate,
  className = '',
}: {
  recordingId: string;
  isLocked: boolean;
  initialRating?: number | null;
  onRate?: (rating: number) => void;
  className?: string;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Update local rating state when initialRating prop changes
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleClick = (score: number) => {
    if (isLocked) return;
    setRating(score);
    if (onRate) {
      onRate(score);
    }
  };

  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-center justify-center gap-1 w-full max-w-xs">
        {[1, 2, 3, 4, 5].map((score) => {
          const isFilled = score <= displayRating;
          const isDisabled = isLocked;

          return (
            <button
              key={score}
              type="button"
              onClick={() => handleClick(score)}
              onMouseEnter={() => !isDisabled && setHoverRating(score)}
              onMouseLeave={() => !isDisabled && setHoverRating(null)}
              disabled={isDisabled}
              className={`flex-1 h-8 rounded transition-all border-2 bg-white ${
                isFilled
                  ? isDisabled
                    ? 'border-gray-400'
                    : hoverRating !== null
                      ? 'border-[#5A85C9]'
                      : 'border-[#476EAE]'
                  : isDisabled
                    ? 'border-gray-300'
                    : 'border-gray-300 hover:border-[#476EAE]'
              } ${
                isDisabled
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
              aria-label={`Rate ${score} out of 5`}
            >
              <span className={`text-xs font-semibold ${
                isFilled
                  ? isDisabled
                    ? 'text-gray-500'
                    : hoverRating !== null
                      ? 'text-[#5A85C9]'
                      : 'text-[#476EAE]'
                  : 'text-gray-400'
              }`}>
                {score}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-center">
        {!isLocked && rating !== null && (
          <span className="text-sm text-gray-600 font-medium">
            評分：{rating} / 5
          </span>
        )}
        {isLocked && (
          <span className="text-xs text-gray-400">
            上傳音檔後即可評分
          </span>
        )}
      </div>
    </div>
  );
}

export default function PeerReviewRatingPage() {
  const params = useParams();
  const userId = params.userId as string;
  const courseId = params.courseId as string;

  const [userName, setUserName] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<'original' | 'user' | 'both' | null>(null);

  // Get current recording and sentence data
  const currentRecording = recordings[currentIndex];
  const sentences = practiceSentences[courseId] || [];
  const sentence = currentRecording ? sentences.find(s => s.id === currentRecording.sentenceId) : undefined;

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/peer-review/${userId}/${courseId}/recordings`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }

        const data = await response.json();
        if (data.success) {
          setUserName(data.userName);
          setRecordings(data.recordings);

          // Initialize ratings from existing data
          const initialRatings: { [key: string]: number } = {};
          data.recordings.forEach((rec: Recording) => {
            if (rec.myRating !== null) {
              initialRatings[rec.id] = rec.myRating;
            }
          });
          setRatings(initialRatings);

          // Auto-jump to first unrated recording
          const firstUnratedIndex = data.recordings.findIndex((rec: Recording) => rec.myRating === null);
          if (firstUnratedIndex !== -1) {
            setCurrentIndex(firstUnratedIndex);
          }
        } else {
          throw new Error(data.error || 'Failed to fetch recordings');
        }
      } catch (err) {
        console.error('Error fetching recordings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recordings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, [userId, courseId]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setPlayingAudio(null); // Stop any playing audio
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < recordings.length - 1) {
      setPlayingAudio(null); // Stop any playing audio
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, recordings.length]);

  const handleRate = useCallback(async (recordingId: string, score: number) => {
    // Optimistically update UI
    setRatings(prev => ({
      ...prev,
      [recordingId]: score,
    }));

    try {
      // Submit rating to peer review API
      const response = await fetch('/api/peer-review/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          recordingId,
          score,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Failed to submit peer review rating:', error);
      // Revert optimistic update on error
      setRatings(prev => {
        const newRatings = { ...prev };
        delete newRatings[recordingId];
        return newRatings;
      });
    }
  }, []);

  const handlePlayBoth = useCallback(() => {
    if (!sentence?.audioSrc || !currentRecording?.audioUrl) {
      return;
    }

    setPlayingAudio(prev => (prev === 'both' ? null : 'both'));
  }, [sentence?.audioSrc, currentRecording?.audioUrl]);

  useEffect(() => {
    setPlayingAudio(null);
  }, [currentRecording?.id]);

  // Calculate progress
  const ratedCount = Object.keys(ratings).length;
  const totalCount = recordings.length;
  const progressPercentage = totalCount > 0 ? Math.round((ratedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#476EAE]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-red-600">錯誤：{error}</p>
          <Link
            href={`/dashboard/peer-review/${userId}`}
            className="mt-4 inline-flex items-center gap-2 text-[#476EAE] hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            返回課程列表
          </Link>
        </div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-gray-600">此課程沒有錄音</p>
          <Link
            href={`/dashboard/peer-review/${userId}`}
            className="mt-4 inline-flex items-center gap-2 text-[#476EAE] hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            返回課程列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:py-12">
      {/* Header with Back Button */}
      <header className="rounded-xl bg-white p-6 shadow-sm">
        <Link
          href={`/dashboard/peer-review/${userId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 transition hover:text-[#476EAE]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          返回課程列表
        </Link>

        <div className="flex items-center gap-4">
          {/* User Avatar */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#476EAE]/10 text-[#476EAE]">
            <UserIcon className="h-6 w-6" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">評分 - {userName}</h1>
            <p className="text-sm text-gray-600">{sentence?.text || (currentRecording ? `Sentence ${currentRecording.sentenceId}` : '載入中...')}</p>
          </div>

          {/* Progress Badge */}
          <div className="text-right">
            <div className="text-2xl font-bold text-[#476EAE]">
              {ratedCount} / {totalCount}
            </div>
            <div className="text-xs text-gray-500">已評分</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-[#476EAE] transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </header>

      {/* Navigation Info */}
      <div className="rounded-xl bg-[#476EAE]/5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            錄音 {currentIndex + 1} / {recordings.length}
          </span>
          <span className="text-gray-600">
            槽位 {currentRecording?.slotIndex + 1}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">評分指南</h3>
        <ul className="space-y-1 text-xs text-blue-800">
          <li>• 先播放<span className="font-semibold text-[#476EAE]">原音檔</span>聆聽標準發音</li>
          <li>• 再播放<span className="font-semibold text-[#41A67E]">使用者錄音</span>進行對比</li>
          <li>• 根據發音準確度、流暢度等給予 1-5 分評分</li>
          <li>• 使用左右按鈕快速切換不同錄音</li>
        </ul>
      </div>

      {/* Main Rating Card */}
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        {currentRecording && (
          <div className="space-y-6">
            {/* Sentence Text */}
            {sentence && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-center text-lg font-medium text-gray-900">
                  {sentence.text}
                </p>
              </div>
            )}

            {/* Audio Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Audio */}
              <div className="rounded-lg border-2 border-[#476EAE]/30 bg-[#476EAE]/5 p-6">
                <h4 className="mb-3 text-center text-sm font-semibold text-[#476EAE]">
                  原音檔
                </h4>
                {sentence?.audioSrc ? (
                  <>
                    <div className="flex justify-center">
                      <AudioPlayer
                        audioUrl={sentence.audioSrc}
                        isPlaying={playingAudio === 'original' || playingAudio === 'both'}
                        onPlay={() => setPlayingAudio('original')}
                        onPause={() =>
                          setPlayingAudio(prev =>
                            prev === 'original' || prev === 'both' ? null : prev
                          )
                        }
                        className="flex justify-center"
                      />
                    </div>
                    <p className="mt-2 text-center text-xs text-gray-600">
                      標準發音參考
                    </p>
                  </>
                ) : (
                  <p className="text-center text-xs text-gray-500">無原音檔</p>
                )}
              </div>

              {/* User Recording */}
              <div className="rounded-lg border-2 border-[#41A67E]/30 bg-[#41A67E]/5 p-6">
                <h4 className="mb-3 text-center text-sm font-semibold text-[#41A67E]">
                  使用者錄音
                </h4>
                <div className="flex justify-center">
                  <AudioPlayer
                    audioUrl={currentRecording.audioUrl}
                    isPlaying={playingAudio === 'user' || playingAudio === 'both'}
                    onPlay={() => setPlayingAudio('user')}
                    onPause={() =>
                      setPlayingAudio(prev =>
                        prev === 'user' || prev === 'both' ? null : prev
                      )
                    }
                    className="flex justify-center"
                  />
                </div>
                <div className="mt-2 text-center text-xs text-gray-600">
                  時長: {(currentRecording.duration / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
            {sentence?.audioSrc && currentRecording?.audioUrl && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handlePlayBoth}
                  className={`inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition ${
                    playingAudio === 'both'
                      ? 'border-[#41A67E] bg-[#41A67E] text-white hover:bg-[#349269]'
                      : 'border-[#476EAE] text-[#476EAE] hover:bg-[#476EAE] hover:text-white'
                  }`}
                >
                  {playingAudio === 'both' ? (
                    <>
                      <PauseIcon className="h-5 w-5" />
                      停止同時播放
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5" />
                      同時播放
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Rating Section */}
            <div className="border-t pt-6">
              <h3 className="mb-4 text-center text-base font-medium text-gray-900">
                你的評分
              </h3>
              <PeerReviewRatingBar
                recordingId={currentRecording.id}
                isLocked={false}
                initialRating={ratings[currentRecording.id] || null}
                onRate={(score) => handleRate(currentRecording.id, score)}
                className="mb-4"
              />

              {ratings[currentRecording.id] && (
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#476EAE]/10 px-3 py-1 text-sm text-[#476EAE]">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    已評分
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 rounded-lg border-2 border-[#476EAE] px-6 py-3 font-medium text-[#476EAE] transition hover:bg-[#476EAE] hover:text-white disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          上一個
        </button>

        <div className="text-center text-sm text-gray-600">
          <div className="flex gap-1">
            {recordings.map((rec, idx) => (
              <div
                key={rec.id}
                className={`h-2 w-2 rounded-full ${
                  idx === currentIndex
                    ? 'bg-[#476EAE]'
                    : ratings[rec.id]
                      ? 'bg-[#A7E399]'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex === recordings.length - 1}
          className="flex items-center gap-2 rounded-lg border-2 border-[#476EAE] px-6 py-3 font-medium text-[#476EAE] transition hover:bg-[#476EAE] hover:text-white disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          下一個
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">總計</p>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">已評分</p>
            <p className="text-xl font-bold text-[#476EAE]">{ratedCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">未評分</p>
            <p className="text-xl font-bold text-gray-400">{totalCount - ratedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
