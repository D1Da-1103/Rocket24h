import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { authedFetch, readApiError } from './api';

export interface LikeSummary {
  count: number;
  likedByViewer: boolean;
}

/**
 * Like được đếm bằng aggregation trên subcollection (dữ liệu dẫn xuất),
 * không lưu bộ đếm trên Spot nên không thể đếm hai lần.
 */
export async function fetchLikeSummaries(
  spotIds: string[],
  viewerUid: string
): Promise<Map<string, LikeSummary>> {
  const entries = await Promise.all(
    spotIds.map(async (spotId) => {
      try {
        const likesRef = collection(db, 'spots', spotId, 'likes');
        const [countSnap, mineSnap] = await Promise.all([
          getCountFromServer(query(likesRef)),
          getDoc(doc(db, 'spots', spotId, 'likes', viewerUid)),
        ]);
        return [
          spotId,
          { count: countSnap.data().count, likedByViewer: mineSnap.exists() },
        ] as const;
      } catch {
        return [spotId, { count: 0, likedByViewer: false }] as const;
      }
    })
  );

  return new Map(entries);
}

/**
 * Like/bỏ like qua Route Handler. docId = UID nên bấm lặp không tạo bản ghi trùng;
 * server chỉ tạo thông báo một lần cho mỗi cặp (Spot, người like).
 */
export async function setSpotLike(
  spotId: string,
  liked: boolean
): Promise<LikeSummary> {
  const res = await authedFetch(`/api/spots/${encodeURIComponent(spotId)}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const body = (await res.json()) as { likeCount: number; liked: boolean };
  return { count: body.likeCount, likedByViewer: body.liked };
}
