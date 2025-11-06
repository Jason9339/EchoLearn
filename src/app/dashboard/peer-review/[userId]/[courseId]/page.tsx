'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  ratingCount: number;
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
  const [hideFullyRated, setHideFullyRated] = useState(false);

  const visibleRecordings = useMemo(() => {
    if (!hideFullyRated) {
      return recordings;
    }
    return recordings.filter((rec) => rec.ratingCount < 3);
  }, [hideFullyRated, recordings]);

  // Get current recording and sentence data
  const currentRecording = visibleRecordings[currentIndex];
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

  useEffect(() => {
    if (visibleRecordings.length === 0) {
      if (currentIndex !== 0) {
        setCurrentIndex(0);
      }
      return;
    }

    if (currentIndex >= visibleRecordings.length) {
      setCurrentIndex(visibleRecordings.length - 1);
    }
  }, [visibleRecordings.length, currentIndex]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setPlayingAudio(null); // Stop any playing audio
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < visibleRecordings.length - 1) {
      setPlayingAudio(null); // Stop any playing audio
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, visibleRecordings.length]);

  const handleRate = useCallback(async (recordingId: string, score: number) => {
    const targetRecording = recordings.find(rec => rec.id === recordingId);
    const previousMyRating = targetRecording?.myRating ?? null;
    const previousRatingCount = targetRecording?.ratingCount ?? 0;
    const hadExistingRating =
      ratings[recordingId] !== undefined || previousMyRating !== null;

    // Optimistically update UI
    setRatings(prev => ({
      ...prev,
      [recordingId]: score,
    }));

    if (targetRecording) {
      setRecordings(prev =>
        prev.map(rec =>
          rec.id === recordingId
            ? {
                ...rec,
                myRating: score,
                ratingCount: hadExistingRating ? previousRatingCount : previousRatingCount + 1,
              }
            : rec
        )
      );
    }

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
        if (hadExistingRating && previousMyRating !== null) {
          newRatings[recordingId] = previousMyRating;
        } else {
          delete newRatings[recordingId];
        }
        return newRatings;
      });
      if (targetRecording) {
        setRecordings(prev =>
          prev.map(rec =>
            rec.id === recordingId
              ? {
                  ...rec,
                  myRating: previousMyRating,
                  ratingCount: previousRatingCount,
                }
              : rec
          )
        );
      }
    }
  }, [recordings, ratings]);

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
  const ratedCount = visibleRecordings.reduce(
    (count, recording) => (ratings[recording.id] !== undefined ? count + 1 : count),
    0
  );
  const totalCount = visibleRecordings.length;
  const progressPercentage = totalCount > 0 ? Math.round((ratedCount / totalCount) * 100) : 0;
  const hasVisibleRecordings = totalCount > 0;
  const filteredOutCount = recordings.length - totalCount;

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
            <p className="text-sm text-gray-600">
              {sentence?.text ||
                (currentRecording
                  ? `Sentence ${currentRecording.sentenceId}`
                  : hideFullyRated
                    ? '目前沒有符合過濾條件的錄音'
                    : '載入中...')}
            </p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-600">
            錄音 {hasVisibleRecordings ? currentIndex + 1 : 0} / {totalCount}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {hideFullyRated && filteredOutCount > 0 && (
              <span className="text-xs text-gray-500">
                已隱藏 {filteredOutCount} 個錄音
              </span>
            )}
            <button
              type="button"
              onClick={() => setHideFullyRated(prev => !prev)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                hideFullyRated
                  ? 'border-[#476EAE] bg-[#476EAE] text-white hover:bg-[#5A85C9]'
                  : 'border-[#476EAE] text-[#476EAE] hover:bg-[#476EAE]/10'
              }`}
            >
              {hideFullyRated ? '顯示所有錄音' : '過濾滿 3 次評分'}
            </button>
          </div>
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
        {currentRecording ? (
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
                className="mb-2"
              />

              <div className="flex flex-col items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  currentRecording.ratingCount >= 3
                    ? 'bg-green-100 text-green-700'
                    : currentRecording.ratingCount >= 2
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                }`}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {currentRecording.ratingCount} / 3 人已評分
                </span>

                {ratings[currentRecording.id] && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#476EAE]/10 px-3 py-1 text-sm text-[#476EAE]">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    已評分
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-600">
            {hideFullyRated
              ? '所有錄音都已達 3 次評分，關閉過濾即可檢視完整列表。'
              : '目前沒有可顯示的錄音。'}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevious}
          disabled={!hasVisibleRecordings || currentIndex === 0}
          className="flex items-center gap-2 rounded-lg border-2 border-[#476EAE] px-6 py-3 font-medium text-[#476EAE] transition hover:bg-[#476EAE] hover:text-white disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          上一個
        </button>

        <button
          onClick={handleNext}
          disabled={!hasVisibleRecordings || currentIndex === totalCount - 1}
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
            <p className="text-sm text-gray-600">可評錄音</p>
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
