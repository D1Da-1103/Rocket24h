'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchUnreadNotificationCount } from '@/lib/data/notifications';
import Avatar from './Avatar';
import {
  Bell,
  Compass,
  MapPin,
  PlusCircle,
  Users,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    fetchUnreadNotificationCount(user.uid)
      .then((count) => {
        if (!cancelled) setUnreadCount(count);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const navLinks = [
    { href: '/', label: 'Bảng tin', icon: Compass },
    { href: '/map', label: 'Bản đồ', icon: MapPin },
    { href: '/friends', label: 'Bạn bè', icon: Users },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Compass className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Rocket24h
            </span>
            <span className="text-[10px] uppercase font-semibold text-stone-600 tracking-wider -mt-1">
              Nhật ký ẩm thực & du lịch
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-600' : 'text-stone-600'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User CTA & Profile / Login */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/spots/new"
                id="nav-create-spot-btn"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                Tạo Spot
              </Link>

              <Link
                href="/notifications"
                className="relative p-2 text-stone-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                title="Thông báo"
                aria-label={
                  unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'
                }
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                  title="Trang cá nhân"
                >
                  <Avatar path={profile?.avatarPath} name={profile?.displayName} size="sm" />
                  <span className="text-sm font-medium text-stone-700 max-w-[120px] truncate">
                    {profile?.displayName || 'Thành viên'}
                  </span>
                </Link>

                <button
                  onClick={() => logout()}
                  title="Đăng xuất"
                  className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <>
              <Link
                href="/notifications"
                className="relative p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
                title="Thông báo"
                aria-label={
                  unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'
                }
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/spots/new"
                className="p-2 text-white bg-orange-500 rounded-lg shadow-sm"
                title="Tạo Spot mới"
              >
                <PlusCircle className="w-5 h-5" />
              </Link>
            </>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-100"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-2">
          {user && (
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <Avatar path={profile?.avatarPath} name={profile?.displayName} />
              <div>
                <p className="font-semibold text-stone-800 text-sm">{profile?.displayName}</p>
                <p className="text-xs text-stone-600">{user.email}</p>
              </div>
            </div>
          )}

          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  active ? 'text-orange-600 bg-orange-50' : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}

          {user ? (
            <>
              <Link
                href="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                <span className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  Thông báo
                </span>
                {unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                <User className="w-5 h-5" />
                Hồ sơ cá nhân
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                Đăng xuất
              </button>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-stone-700 bg-stone-100 rounded-lg"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg shadow-sm"
              >
                Đăng ký tài khoản
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
