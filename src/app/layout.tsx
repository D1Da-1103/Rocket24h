import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthContext';
import { MapProvider } from '@/components/map/MapProvider';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Rocket24h - Nhật Ký Trải Nghiệm Ẩm Thực & Du Lịch',
  description:
    'Ghi lại những nơi đã ghé, chia sẻ có chọn lọc với bạn bè và khám phá bản đồ trải nghiệm cá nhân.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-stone-50 text-stone-900 antialiased`}>
        <AuthProvider>
          <MapProvider>
            <Suspense fallback={<header className="h-16 border-b border-stone-200 bg-white/90" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-600">
              <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>© 2026 Rocket24h - Đồ án Chuyên đề Công nghệ thông tin (Đại học Thủy Lợi).</p>
                <p>Bản đồ sử dụng dữ liệu &copy; OpenStreetMap contributors.</p>
              </div>
            </footer>
          </MapProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
