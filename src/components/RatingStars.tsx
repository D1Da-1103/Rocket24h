'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  value: number | null;
  onChange: (val: number | null) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: RatingStarsProps) {
  const starSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const current = value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= current;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              // Nếu bấm lại vào sao đang chọn thì bỏ chọn (null)
              if (value === star) {
                onChange(null);
              } else {
                onChange(star);
              }
            }}
            className={`transition-transform ${
              readOnly
                ? 'cursor-default'
                : 'hover:scale-110 active:scale-95 focus:outline-none'
            }`}
            title={readOnly ? `${value || 0} sao` : `Đánh giá ${star} sao`}
          >
            <Star
              className={`${starSizes[size]} ${
                filled
                  ? 'fill-amber-400 text-amber-500'
                  : 'fill-stone-100 text-stone-300'
              }`}
            />
          </button>
        );
      })}
      {!readOnly && value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-stone-600 hover:text-stone-800 underline"
        >
          Xóa
        </button>
      )}
    </div>
  );
}
