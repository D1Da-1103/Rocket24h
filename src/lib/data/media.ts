import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../firebase/client';

const urlCache = new Map<string, string>();

/**
 * Ảnh có thể được lưu dưới hai dạng:
 * - Storage object path: `spots/{uid}/{spotId}/{file}` (bắt buộc với ảnh Spot)
 * - URL ngoài (dữ liệu seed/demo hoặc avatar cũ)
 *
 * Với object path, URL tải được lấy tại thời điểm hiển thị sau khi Storage Rules
 * đã kiểm quyền theo bài viết. Không lưu URL có token vào tài liệu chia sẻ.
 */
export function isRemoteMediaPath(path: string): boolean {
  return /^(https?:\/\/|\/)/i.test(path);
}

export async function resolveMediaUrl(path: string): Promise<string> {
  if (!path) return '';
  if (isRemoteMediaPath(path)) return path;

  const cached = urlCache.get(path);
  if (cached) return cached;

  const url = await getDownloadURL(ref(storage, path));
  urlCache.set(path, url);
  return url;
}

export async function resolveMediaUrls(paths: string[] | null | undefined): Promise<string[]> {
  if (!paths || paths.length === 0) return [];
  const resolved = await Promise.all(
    paths.map(async (path) => {
      try {
        return await resolveMediaUrl(path);
      } catch {
        return '';
      }
    })
  );
  return resolved.filter(Boolean);
}
