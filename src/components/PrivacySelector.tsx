'use client';

import React from 'react';
import { VisibilityScope, LocationMode } from '@/lib/domain/types';
import { Globe, Users, Lock, MapPin, EyeOff, AlertTriangle } from 'lucide-react';

interface PrivacySelectorProps {
  visibility: VisibilityScope;
  onVisibilityChange: (v: VisibilityScope) => void;
  locationMode: LocationMode;
  onLocationModeChange: (m: LocationMode) => void;
}

export default function PrivacySelector({
  visibility,
  onVisibilityChange,
  locationMode,
  onLocationModeChange,
}: PrivacySelectorProps) {
  const visibilityOptions: { id: VisibilityScope; label: string; desc: string; icon: typeof Globe }[] = [
    {
      id: 'public',
      label: 'Công khai',
      desc: 'Mọi thành viên trên Rocket24h đều có thể xem',
      icon: Globe,
    },
    {
      id: 'friends',
      label: 'Bạn bè',
      desc: 'Chỉ những người bạn đã chấp nhận mới được xem',
      icon: Users,
    },
    {
      id: 'private',
      label: 'Chỉ mình tôi',
      desc: 'Nhật ký bí mật, chỉ một mình bạn có thể truy cập',
      icon: Lock,
    },
  ];

  const locationOptions: { id: LocationMode; label: string; desc: string; icon: typeof MapPin }[] = [
    {
      id: 'exact',
      label: 'Vị trí chính xác',
      desc: 'Hiển thị tên quán, địa chỉ và ghim trên bản đồ',
      icon: MapPin,
    },
    {
      id: 'hidden',
      label: 'Ẩn vị trí trải nghiệm',
      desc: 'Người xem không thấy địa chỉ, chỉ bạn mới xem lại được trên bản đồ',
      icon: EyeOff,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Phạm vi bài viết */}
      <div>
        <label className="block text-sm font-bold text-stone-900 mb-2">
          1. Ai có thể xem bài viết này? (Phạm vi hiển thị)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visibilityOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = visibility === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onVisibilityChange(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selected
                    ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-500/20'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      selected ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-sm font-bold ${selected ? 'text-orange-950' : 'text-stone-800'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Chế độ chia sẻ vị trí */}
      <div>
        <label className="block text-sm font-bold text-stone-900 mb-2">
          2. Chia sẻ vị trí địa điểm
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {locationOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = locationMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onLocationModeChange(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selected
                    ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-500/20'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      selected ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-sm font-bold ${selected ? 'text-orange-950' : 'text-stone-800'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {locationMode === 'hidden' && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Bảo mật cấp tài liệu cho vị trí ẩn:</p>
              <p className="mt-0.5 text-amber-700">
                Tài liệu Spot sẽ không chứa bất kỳ tọa độ, địa chỉ hay geohash nào. Tham chiếu thật được lưu riêng ở bộ nhớ cá nhân của bạn. Hãy đảm bảo phần chú thích không vô tình viết lộ số nhà hay địa chỉ nhạy cảm!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
