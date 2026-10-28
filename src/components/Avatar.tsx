'use client';

import React from 'react';
import { useMediaUrl } from '@/features/media/useMediaUrls';

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-24 h-24 text-3xl',
} as const;

interface AvatarProps {
  path?: string | null;
  name?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * Ảnh đại diện dùng chung: tự chuyển object path Storage thành URL ngắn hạn
 * và luôn có alt text.
 */
export default function Avatar({ path, name, size = 'md', className = '' }: AvatarProps) {
  const url = useMediaUrl(path);
  const label = name?.trim() || 'Thành viên';

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full bg-orange-100 border border-orange-200 overflow-hidden flex items-center justify-center font-bold text-orange-600 flex-shrink-0 ${className}`}
    >
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden="true">{label.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
