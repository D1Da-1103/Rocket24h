import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Spot, Place } from '@/lib/domain/types';
import { mergeUniqueSorted, takePage } from '@/lib/domain/feed-merge';
import { fetchProfilesByUids } from '@/lib/data/users';
import { fetchLikeSummaries } from '@/lib/data/likes';
import { measurePerformance } from '@/lib/performance';

export interface FeedItem {
  spot: Spot;
  place: Place | null;
  authorProfile?: {
    displayName: string;
    avatarPath: string | null;
  };
  likeCount: number;
  likedByViewer: boolean;
}

export interface FeedSourceState {
  uid: string;
  isSelf: boolean;
  cursor: DocumentSnapshot | null;
  exhausted: boolean;
  buffer: Spot[];
  error: string | null;
}

/**
 * Trạng thái phân trang giữ một con trỏ riêng cho mỗi nguồn (bản thân + từng bạn).
 * Không tải cả collection, không lọc toàn bộ ở trình duyệt.
 */
export interface FeedPagerState {
  myUid: string;
  pageSize: number;
  sources: FeedSourceState[];
}

export interface FeedPageResult {
  items: FeedItem[];
  state: FeedPagerState;
  hasMore: boolean;
  isPartial: boolean;
  errors: string[];
}

export function createFeedPagerState(
  myUid: string,
  friendUids: string[],
  pageSize: number
): FeedPagerState {
  const uids = Array.from(new Set([myUid, ...friendUids.filter((uid) => uid !== myUid)]));
  return {
    myUid,
    pageSize,
    sources: uids.map((uid) => ({
      uid,
      isSelf: uid === myUid,
      cursor: null,
      exhausted: false,
      buffer: [],
      error: null,
    })),
  };
}

function mapSpot(snap: DocumentSnapshot): Spot {
  return { id: snap.id, ...snap.data() } as Spot;
}

async function fetchSourcePage(
  source: FeedSourceState,
  pageSize: number
): Promise<Spot[]> {
  const constraints = source.isSelf
    ? [
        where('authorId', '==', source.uid),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ]
    : [
        where('authorId', '==', source.uid),
        where('visibility', 'in', ['public', 'friends']),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ];

  const base = query(collection(db, 'spots'), ...constraints);
  const q = source.cursor
    ? query(collection(db, 'spots'), ...constraints, startAfter(source.cursor))
    : base;

  const snap = await getDocs(q);
  const spots = snap.docs.map(mapSpot);
  source.cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : source.cursor;
  source.exhausted = snap.docs.length < pageSize;
  return spots;
}

async function loadPlacesForPage(
  spots: Spot[],
  myUid: string
): Promise<Map<string, Place>> {
  const sharedIds = Array.from(
    new Set(
      spots
        .filter((s) => s.placeId && s.locationMode !== 'hidden')
        .map((s) => s.placeId as string)
    )
  );

  const result = new Map<string, Place>();

  for (let i = 0; i < sharedIds.length; i += 10) {
    const chunk = sharedIds.slice(i, i + 10);
    if (chunk.length === 0) continue;
    try {
      const snap = await getDocs(
        query(collection(db, 'places'), where(documentId(), 'in', chunk))
      );
      snap.forEach((d) => {
        const data = d.data();
        result.set(d.id, {
          id: d.id,
          name: data.name,
          nameNormalized: data.nameNormalized,
          category: data.category,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          geohash: data.geohash,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          isPrivate: false,
        });
      });
    } catch (error) {
      console.warn('Không tải được thông tin Place cho feed:', error);
    }
  }

  // Spot của chính mình có thể tham chiếu Place riêng tư (không nằm trong places/)
  const ownPrivateIds = Array.from(
    new Set(
      spots
        .filter(
          (s) =>
            s.authorId === myUid &&
            s.placeId &&
            s.locationMode !== 'hidden' &&
            !result.has(s.placeId)
        )
        .map((s) => s.placeId as string)
    )
  );

  await Promise.all(
    ownPrivateIds.map(async (placeId) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, `users/${myUid}/privatePlaces`),
            where(documentId(), '==', placeId)
          )
        );
        snap.forEach((d) => {
          const data = d.data();
          result.set(d.id, {
            id: d.id,
            name: data.name,
            nameNormalized: data.nameNormalized,
            category: data.category,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            geohash: data.geohash,
            createdBy: myUid,
            createdAt: null,
            isPrivate: true,
          });
        });
      } catch {
        // Place riêng không đọc được: coi như không có metadata địa điểm
      }
    })
  );

  return result;
}

/**
 * Tải một trang Feed:
 * 1. Bổ sung buffer cho các nguồn đã cạn buffer (giữ con trỏ riêng từng nguồn)
 * 2. Gộp theo createdAt + id, loại trùng theo spotId
 * 3. Cắt đúng pageSize và giữ phần dư trong buffer cho lần "Tải thêm"
 *
 * Nguồn lỗi không làm mất dữ liệu đã tải; lần gọi sau sẽ thử lại nguồn đó.
 */
export async function loadFeedPage(state: FeedPagerState): Promise<FeedPageResult> {
  const { pageSize } = state;
  const errors: string[] = [];
  const performanceStart = `feed-start-${Date.now()}-${Math.random()}`;
  if (typeof performance !== 'undefined') performance.mark(performanceStart);

  await Promise.all(
    state.sources.map(async (source) => {
      if (source.buffer.length > 0 || source.exhausted) return;
      try {
        source.buffer = await fetchSourcePage(source, pageSize);
        source.error = null;
      } catch (error) {
        source.error = error instanceof Error ? error.message : 'Lỗi tải nguồn';
        errors.push(source.error);
      }
    })
  );

  const merged = mergeUniqueSorted(state.sources.map((s) => s.buffer));
  const { page } = takePage(merged, pageSize);

  const consumed = new Set(page.map((s) => s.id));
  state.sources.forEach((source) => {
    source.buffer = source.buffer.filter((s) => !consumed.has(s.id));
  });

  const hasMore = state.sources.some((s) => s.buffer.length > 0 || !s.exhausted);

  const placeMap = await loadPlacesForPage(page, state.myUid);
  const [profiles, likeSummaries] = await Promise.all([
    fetchProfilesByUids(page.map((s) => s.authorId)),
    fetchLikeSummaries(
      page.map((s) => s.id),
      state.myUid
    ),
  ]);

  const items: FeedItem[] = page.map((spot) => {
    const profile = profiles.get(spot.authorId);
    const likes = likeSummaries.get(spot.id);
    return {
      spot,
      place:
        spot.locationMode === 'hidden' || !spot.placeId
          ? null
          : placeMap.get(spot.placeId) || null,
      authorProfile: profile
        ? { displayName: profile.displayName, avatarPath: profile.avatarPath }
        : { displayName: 'Thành viên', avatarPath: null },
      likeCount: likes?.count || 0,
      likedByViewer: likes?.likedByViewer || false,
    };
  });

  if (typeof performance !== 'undefined') {
    const measurement = measurePerformance('feed-page-load', performanceStart, `${performanceStart}-end`);
    if (measurement) {
      console.info(`[performance] ${measurement.name}: ${measurement.durationMs}ms`);
    }
  }

  return {
    items,
    state,
    hasMore,
    isPartial: errors.length > 0,
    errors,
  };
}
