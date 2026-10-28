'use client';

import { useEffect, useState } from 'react';
import { resolveMediaUrl } from '@/lib/data/media';

/**
 * Chuyển object path trong Storage thành URL tải ngắn hạn tại thời điểm hiển thị.
 * URL ngoài (seed/demo) được giữ nguyên.
 *
 * State được gắn với path đã resolve: khi path đổi, giá trị cũ không bị dùng lại
 * và effect không cần setState đồng bộ để xóa kết quả trước đó.
 */
export function useMediaUrl(path: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    resolveMediaUrl(path)
      .then((url) => {
        if (!cancelled) setResolved({ path, url });
      })
      .catch(() => {
        if (!cancelled) setResolved({ path, url: null });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return path && resolved?.path === path ? resolved.url : null;
}

export function useMediaUrls(paths: string[] | null | undefined): string[] {
  const key = (paths || []).join('|');
  const [resolved, setResolved] = useState<{ key: string; urls: string[] }>({
    key: '',
    urls: [],
  });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    Promise.all(key.split('|').map((path) => resolveMediaUrl(path).catch(() => ''))).then(
      (urls) => {
        if (!cancelled) setResolved({ key, urls: urls.filter(Boolean) });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [key]);

  return resolved.key === key ? resolved.urls : [];
}
