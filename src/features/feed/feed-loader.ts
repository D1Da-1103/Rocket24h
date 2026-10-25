import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  DocumentSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Spot, Place } from '@/lib/domain/types';

export interface FeedItem {
  spot: Spot;
  place: Place | null;
  authorProfile?: {
    displayName: string;
    avatarPath: string | null;
  };
}

export interface MultiSourceFeedResult {
  items: FeedItem[];
  cursors: Map<string, DocumentSnapshot>;
  hasMore: boolean;
}

/**
 * Tải Feed phân trang theo đúng quy tắc bảo mật của Section 8:
 * - Không tải toàn bộ collection rồi lọc ở client
 * - Truy vấn ràng buộc theo quyền (spots của chính mình + spots của bạn bè có visibility in ['public', 'friends'])
 * - Gộp kết quả theo createdAt desc và loại trùng
 */
export async function loadFeedPage(
  myUid: string,
  friendUids: string[],
  pageSize: number = 20
): Promise<FeedItem[]> {
  const sources = [myUid, ...friendUids];
  const allSpots: Spot[] = [];
  const placeCache = new Map<string, Place | null>();
  const userProfileCache = new Map<string, { displayName: string; avatarPath: string | null }>();

  // Truy vấn song song cho từng nguồn
  const promises = sources.map(async (uid) => {
    try {
      let q;
      if (uid === myUid) {
        // Của chính mình: lấy tất cả các phạm vi
        q = query(
          collection(db, 'spots'),
          where('authorId', '==', myUid),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      } else {
        // Của bạn bè: chỉ lấy public hoặc friends
        q = query(
          collection(db, 'spots'),
          where('authorId', '==', uid),
          where('visibility', 'in', ['public', 'friends']),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      const snap = await getDocs(q);
      const spotsForSource: Spot[] = [];
      snap.forEach((d) => {
        spotsForSource.push({ id: d.id, ...d.data() } as Spot);
      });
      return spotsForSource;
    } catch (err) {
      console.warn(`Lỗi khi tải feed từ nguồn ${uid}:`, err);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((list) => allSpots.push(...list));

  // Loại trùng và sắp xếp giảm dần theo createdAt
  const uniqueMap = new Map<string, Spot>();
  for (const s of allSpots) {
    if (!uniqueMap.has(s.id)) {
      uniqueMap.set(s.id, s);
    }
  }

  const sortedSpots = Array.from(uniqueMap.values());
  sortedSpots.sort((a, b) => {
    const getTimeSeconds = (t: unknown): number => {
      if (!t) return 0;
      if (typeof t === 'object' && t !== null && 'seconds' in t) {
        return (t as { seconds: number }).seconds || 0;
      }
      if (t instanceof Date) return t.getTime() / 1000;
      if (typeof t === 'string' || typeof t === 'number') return new Date(t).getTime() / 1000;
      return 0;
    };
    return getTimeSeconds(b.createdAt) - getTimeSeconds(a.createdAt);
  });

  const slicedSpots = sortedSpots.slice(0, pageSize);

  // Tải thông tin Place và tác giả kèm theo
  const feedItems: FeedItem[] = [];

  for (const spot of slicedSpots) {
    let placeData: Place | null = null;

    if (spot.placeId && spot.locationMode !== 'hidden') {
      if (placeCache.has(spot.placeId)) {
        placeData = placeCache.get(spot.placeId) || null;
      } else {
        try {
          const placeSnap = await getDoc(doc(db, 'places', spot.placeId));
          if (placeSnap.exists()) {
            const pd = placeSnap.data();
            placeData = {
              id: placeSnap.id,
              name: pd.name,
              nameNormalized: pd.nameNormalized,
              category: pd.category,
              address: pd.address,
              latitude: pd.latitude,
              longitude: pd.longitude,
              geohash: pd.geohash,
              createdBy: pd.createdBy,
              createdAt: pd.createdAt,
            };
          }
          placeCache.set(spot.placeId, placeData);
        } catch {
          placeCache.set(spot.placeId, null);
        }
      }
    }

    // Tải profile người đăng
    let authorProf = userProfileCache.get(spot.authorId);
    if (!authorProf) {
      try {
        const uSnap = await getDoc(doc(db, 'users', spot.authorId));
        if (uSnap.exists()) {
          const ud = uSnap.data();
          authorProf = {
            displayName: ud.displayName || 'Thành viên',
            avatarPath: ud.avatarPath || null,
          };
        } else {
          authorProf = { displayName: 'Thành viên', avatarPath: null };
        }
        userProfileCache.set(spot.authorId, authorProf);
      } catch {
        authorProf = { displayName: 'Thành viên', avatarPath: null };
      }
    }

    feedItems.push({
      spot,
      place: placeData,
      authorProfile: authorProf,
    });
  }

  return feedItems;
}
