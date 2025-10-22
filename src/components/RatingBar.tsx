'use client';

import { useState, useEffect } from 'react';

interface RatingBarProps {
  sentenceId: number;
  slotIndex: number;
  isLocked: boolean; // true if no recording uploaded yet
  initialRating?: number | null;
  onRate?: (rating: number) => void;
  className?: string;
}

/**
 * RatingBar component - displays a horizontal 1-5 grid rating bar
 * Locked when no recording has been uploaded
 */
export default function RatingBar({
  sentenceId,
  slotIndex,
  isLocked,
  initialRating = null,
  onRate,
  className = '',
}: RatingBarProps) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update local rating state when initialRating prop changes
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleClick = async (score: number) => {
    if (isLocked || isSubmitting) return;

    setIsSubmitting(true);
    setRating(score);

    try {
      // Call the parent callback
      if (onRate) {
        onRate(score);
      }

      // Submit rating to server
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sentenceId,
          slotIndex,
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
      console.error('Failed to submit rating:', error);
      // Revert rating on error
      setRating(initialRating);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-center justify-center gap-1 w-full max-w-xs">
        {[1, 2, 3, 4, 5].map((score) => {
          const isFilled = score <= displayRating;
          const isDisabled = isLocked || isSubmitting;

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
