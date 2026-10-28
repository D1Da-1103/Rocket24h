import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  DocumentSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { AppNotification } from '../domain/types';

export interface NotificationPage {
  items: AppNotification[];
  lastCursor: DocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Thông báo mới nhất trước, phân trang bằng cursor.
 * Người nhận chỉ có quyền đổi isRead; việc tạo do server thực hiện.
 */
export async function fetchNotificationsPage(
  uid: string,
  pageSize: number,
  cursor: DocumentSnapshot | null = null
): Promise<NotificationPage> {
  const notificationsRef = collection(db, `users/${uid}/notifications`);
  const q = cursor
    ? query(
        notificationsRef,
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize + 1)
      )
    : query(notificationsRef, orderBy('createdAt', 'desc'), limit(pageSize + 1));

  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const items = pageDocs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type as AppNotification['type'],
      actorId: data.actorId as string,
      targetId: data.targetId as string,
      isRead: Boolean(data.isRead),
      createdAt: data.createdAt as AppNotification['createdAt'],
    };
  });

  return {
    items,
    lastCursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

export async function markNotificationRead(
  uid: string,
  notificationId: string,
  isRead: boolean = true
): Promise<void> {
  await updateDoc(doc(db, `users/${uid}/notifications`, notificationId), { isRead });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, `users/${uid}/notifications`),
      where('isRead', '==', false),
      limit(500)
    )
  );
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

export async function fetchUnreadNotificationCount(uid: string): Promise<number> {
  try {
    const snap = await getCountFromServer(
      query(
        collection(db, `users/${uid}/notifications`),
        where('isRead', '==', false)
      )
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}
