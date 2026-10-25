import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/**
 * Xác thực Bearer ID Token từ header Authorization của request
 * Tuyệt đối không tin UID do client tự khai báo trong body
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Chưa đăng nhập: Thiếu Authorization header hợp lệ');
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    throw new Error('Chưa đăng nhập: Token không hợp lệ');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Token hết hạn hoặc không hợp lệ';
    throw new Error(`Xác thực token thất bại: ${message}`);
  }
}
