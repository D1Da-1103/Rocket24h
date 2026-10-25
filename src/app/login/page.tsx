'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Compass, Lock, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Email hoặc mật khẩu không chính xác');
      } else {
        setError(`Lỗi đăng nhập: ${msg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-200 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-3">
            <Compass className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Chào mừng trở lại!</h1>
          <p className="text-sm text-stone-600 mt-1">Đăng nhập để khám phá & ghi lại nhật ký trải nghiệm</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Email đăng nhập
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@rocket24h.vn"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick Login */}
        <div className="mt-8 pt-6 border-t border-stone-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Tài khoản Demo có sẵn (Seed Data):</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('demo_user1@rocket24h.vn')}
              className="px-2 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-orange-50 hover:text-orange-600 border border-stone-200 rounded-lg transition-colors text-center"
            >
              Alice (User 1)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('demo_user2@rocket24h.vn')}
              className="px-2 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-orange-50 hover:text-orange-600 border border-stone-200 rounded-lg transition-colors text-center"
            >
              Bob (User 2)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('demo_user3@rocket24h.vn')}
              className="px-2 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-orange-50 hover:text-orange-600 border border-stone-200 rounded-lg transition-colors text-center"
            >
              Charlie (User 3)
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-600">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-orange-600 font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
