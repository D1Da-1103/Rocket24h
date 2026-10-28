import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { adminDb, FieldValue } from '@/lib/firebase/admin';
import { canReadSpotForUser, likeNotificationId } from '@/server/spots';
import { toErrorMessage, toErrorStatus } from '@/server/errors';
import { HttpError } from '@/server/errors';

async function getSpotOrThrow(spotId: string) {
  const snap = await adminDb.doc(`spots/${spotId}`).get();
  if (!snap.exists) {
    throw new HttpError('Bài viết không còn khả dụng', 404);
  }
  return snap.data()!;
}

async function countLikes(spotId: string): Promise<number> {
  const snap = await adminDb.collection(`spots/${spotId}/likes`).count().get();
  return snap.data().count;
}

async function handleLike(req: NextRequest, spotId: string, liked: boolean) {
  let actorUid: string;
  try {
    const user = await authenticateRequest(req);
    actorUid = user.uid;
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error, 'Chưa đăng nhập') },
      { status: 401 }
    );
  }

  try {
    const spot = await getSpotOrThrow(spotId);
    const readable = await canReadSpotForUser(actorUid, {
      authorId: spot.authorId as string,
      visibility: spot.visibility,
      status: spot.status,
    });
    if (!readable) {
      throw new HttpError('Bạn không có quyền tương tác với bài viết này', 403);
    }

    const likeRef = adminDb.doc(`spots/${spotId}/likes/${actorUid}`);
    const notificationRef = adminDb.doc(
      `users/${spot.authorId}/notifications/${likeNotificationId(spotId, actorUid)}`
    );

    await adminDb.runTransaction(async (tx) => {
      const [likeSnap, notificationSnap] = await Promise.all([
        tx.get(likeRef),
        tx.get(notificationRef),
      ]);

      if (liked) {
        if (likeSnap.exists) return; // docId = UID: bấm lặp không tạo trùng

        tx.set(likeRef, {
          userId: actorUid,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Không tạo thông báo khi tự like bài của mình, và không tạo trùng.
        if (spot.authorId !== actorUid && !notificationSnap.exists) {
          tx.set(notificationRef, {
            type: 'like',
            actorId: actorUid,
            targetId: spotId,
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return;
      }

      if (likeSnap.exists) {
        tx.delete(likeRef);
      }
    });

    return NextResponse.json({
      liked,
      likeCount: await countLikes(spotId),
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error, 'Không thể cập nhật lượt thích') },
      { status: toErrorStatus(error, 500) }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const { spotId } = await params;
  return handleLike(req, spotId, true);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const { spotId } = await params;
  return handleLike(req, spotId, false);
}
