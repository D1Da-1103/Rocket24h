import {
  collection,
  getDocs,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { UserProfile } from '../domain/types';

function mapProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    uid: id,
    displayName: (data.displayName as string) || 'Thành viên',
    avatarPath: (data.avatarPath as string | null) ?? null,
    createdAt: data.createdAt as UserProfile['createdAt'],
  };
}

/**
 * Tải hồ sơ nhiều người dùng bằng truy vấn theo documentId (tối đa 10 mỗi lần),
 * tránh N+1 và không tải cả collection.
 */
export async function fetchProfilesByUids(
  uids: string[]
): Promise<Map<string, UserProfile>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const result = new Map<string, UserProfile>();

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    if (chunk.length === 0) continue;
    const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.forEach((d) => result.set(d.id, mapProfile(d.id, d.data())));
  }

  return result;
}

export interface ProfileSearchResult {
  uid: string;
  displayName: string;
  avatarPath: string | null;
}
