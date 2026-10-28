import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { deleteSpotCascade } from '@/server/spots';
import { toErrorMessage, toErrorStatus } from '@/server/errors';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spotId: string }> }
) {
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
    const { spotId } = await params;
    const result = await deleteSpotCascade(actorUid, spotId);
    return NextResponse.json({ ok: true, alreadyDeleted: result.alreadyDeleted });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error, 'Không thể xóa bài viết') },
      { status: toErrorStatus(error, 500) }
    );
  }
}
