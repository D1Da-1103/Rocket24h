import { auth } from '../firebase/client';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Gọi Route Handler kèm ID token của người dùng hiện tại.
 * Server tự xác thực token; client không bao giờ gửi UID như nguồn tin cậy.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new ApiError('Bạn cần đăng nhập để thực hiện thao tác này', 401);
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, { ...init, headers });
}

export async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `Yêu cầu thất bại (${res.status})`;
  } catch {
    return `Yêu cầu thất bại (${res.status})`;
  }
}
