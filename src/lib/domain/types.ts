import type { FieldValue } from 'firebase/firestore';

export type VisibilityScope = 'public' | 'friends' | 'private';
export type LocationMode = 'exact' | 'hidden';
export type PlaceScope = 'shared' | 'private';

export type TimestampLike =
  | FieldValue
  | {
      seconds?: number;
      nanoseconds?: number;
      toDate?: () => Date;
    }
  | Date
  | string
  | number
  | null
  | undefined;

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarPath: string | null;
  createdAt: TimestampLike;
}

export interface UserSettings {
  defaultVisibility: VisibilityScope;
  notificationEnabled: boolean;
}

export interface Place {
  id: string;
  name: string;
  nameNormalized: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  geohash: string;
  createdBy: string;
  createdAt: TimestampLike;
  isPrivate?: boolean;
}

export interface PrivatePlace {
  id: string;
  name: string;
  nameNormalized: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  geohash: string;
}

export interface Spot {
  id: string;
  authorId: string;
  placeId: string | null; // null khi locationMode == 'hidden'
  locationMode: LocationMode;
  imagePaths: string[];
  category: string;
  priceVnd: number | null; // null = chưa nhập; 0 = không phát sinh chi phí
  rating: number | null; // 1..5 hoặc null
  caption: string; // <= 1000 ký tự
  visibility: VisibilityScope;
  visitedAt: TimestampLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  status?: 'active' | 'deleting';
}

export interface SpotLocation {
  placeScope: PlaceScope;
  placeKey: string;
}

export interface Friendship {
  pairId: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface FriendLookup {
  friendUid: string;
  acceptedAt: TimestampLike;
}

export interface SavedPlace {
  placeScope: PlaceScope;
  placeId: string;
  hasVisited: boolean;
  isBookmarked: boolean;
  lastVisitedAt: TimestampLike;
}

export interface AppNotification {
  id: string;
  type: 'friend_request' | 'like';
  actorId: string;
  targetId: string;
  isRead: boolean;
  createdAt: TimestampLike;
  actorName?: string;
}

export type FriendshipAction = 'request' | 'accept' | 'reject' | 'cancel' | 'remove';

export type FriendshipState = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export interface MediaRecord {
  ownerId: string;
  spotId: string;
  objectPath: string;
  status: 'temp' | 'attached' | 'orphan';
}

export interface PlaceCategory {
  id: string;
  label: string;
  icon: string;
}
