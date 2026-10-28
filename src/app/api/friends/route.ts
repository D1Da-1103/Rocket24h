import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { applyFriendAction } from '@/server/friends';
import { toErrorMessage, toErrorStatus } from '@/server/errors';
import { FriendshipAction } from '@/lib/domain/types';

interface FriendRequestBody {
  targetUid?: string;
  action?: FriendshipAction;
}

export async function POST(req: NextRequest) {
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
    const body = (await req.json()) as FriendRequestBody;
    if (!body.targetUid || !body.action) {
      return NextResponse.json(
        { error: 'Thiếu targetUid hoặc action' },
        { status: 400 }
      );
    }

    const state = await applyFriendAction(actorUid, body.targetUid, body.action);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error, 'Không thể cập nhật quan hệ bạn bè') },
      { status: toErrorStatus(error, 500) }
    );
  }
}
