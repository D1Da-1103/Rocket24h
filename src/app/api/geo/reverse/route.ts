import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/lib/domain/config';

interface CacheEntry {
  displayName: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
  };
  timestamp: number;
}

// In-memory cache lưu kết quả theo tọa độ làm tròn 4 chữ số thập phân (~11m)
const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

// Biến điều tốc rate-limit <= 1 request / giây
let lastRequestTime = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: 'Thiếu tham số lat hoặc lng' }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Tọa độ không hợp lệ' }, { status: 400 });
    }

    // Key cache làm tròn 4 chữ số thập phân
    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const now = Date.now();

    const cached = geocodeCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        displayName: cached.displayName,
        address: cached.address,
        fromCache: true,
        attribution: '© OpenStreetMap contributors (Nominatim)',
      });
    }

    // Đảm bảo rate-limit tối thiểu 1000ms giữa 2 request tới Nominatim công cộng
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < APP_CONFIG.nominatim.minIntervalMs) {
      const waitTime = APP_CONFIG.nominatim.minIntervalMs - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    // Gọi Nominatim với timeout 5 giây
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi,en`;

    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': APP_CONFIG.nominatim.userAgent,
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Dịch vụ geocoding trả về mã lỗi', status: response.status },
        { status: 502 }
      );
    }

    const data = await response.json();
    const displayName = data.display_name || '';
    const address = data.address || {};

    // Lưu cache
    geocodeCache.set(cacheKey, {
      displayName,
      address,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      displayName,
      address,
      fromCache: false,
      attribution: '© OpenStreetMap contributors (Nominatim)',
    });
  } catch (err: unknown) {
    // Không bao giờ để sập hệ thống khi geocoding lỗi
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const message = err instanceof Error ? err.message : 'Lỗi geocoding';
    return NextResponse.json(
      {
        success: false,
        error: isAbort ? 'Nominatim timeout (>5s)' : message,
        displayName: '',
      },
      { status: 200 }
    );
  }
}
