'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchUserSpots } from '@/lib/data/spots';
import { Spot, Place } from '@/lib/domain/types';
import SpotCard from '@/components/SpotCard';
import {
  Grid,
  Lock,
  Edit2,
  Check,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, updateDisplayName } = useAuth();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [privatePlaces, setPrivatePlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spots' | 'private_places'>('spots');

  // Chỉnh sửa tên hiển thị
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (cancelled) return;
      setNameInput(profile?.displayName || '');
      setLoading(true);
      try {
        // Tải spot của user
        const userSpots = await fetchUserSpots(user.uid);
        if (cancelled) return;
        setSpots(userSpots);

        // Tải private places của user
        const privSnap = await getDocs(collection(db, `users/${user.uid}/privatePlaces`));
        if (cancelled) return;
        const privList: Place[] = [];
        privSnap.forEach((d) => {
          const data = d.data();
          privList.push({
            id: d.id,
            name: data.name,
            nameNormalized: data.nameNormalized,
            category: data.category,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            geohash: data.geohash,
            createdBy: user.uid,
            createdAt: null,
            isPrivate: true,
          });
        });
        setPrivatePlaces(privList);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu trang cá nhân:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, profile?.displayName]);

  const handleSaveName = async () => {
    if (nameInput.trim().length < 2) {
      setErrorNotice('Tên hiển thị phải từ 2 ký tự trở lên');
      return;
    }
    setSavingName(true);
    setErrorNotice(null);
    try {
      await updateDisplayName(nameInput.trim());
      setEditingName(false);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Lỗi khi cập nhật tên');
    } finally {
      setSavingName(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">Vui lòng đăng nhập để xem và quản lý trang cá nhân của bạn.</p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Profile Card Header */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-400 to-amber-500 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-white text-3xl font-extrabold flex-shrink-0">
            {profile?.avatarPath ? (
              <img
                src={profile.avatarPath}
                alt={profile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              profile?.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {!editingName ? (
                <>
                  <h1 className="text-2xl font-extrabold text-stone-900">
                    {profile?.displayName}
                  </h1>
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-1 text-stone-600 hover:text-stone-800 rounded transition-colors"
                    title="Đổi tên hiển thị"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="px-3 py-1 bg-stone-50 border border-stone-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Lưu
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameInput(profile?.displayName || '');
                    }}
                    className="px-2.5 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-semibold hover:bg-stone-200"
                  >
                    Hủy
                  </button>
                </div>
              )}
            </div>

            {errorNotice && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorNotice}</span>
              </p>
            )}

            <p className="text-xs text-stone-600 font-mono">UID: {user.uid}</p>
            <p className="text-xs text-stone-600">{user.email}</p>

            <div className="flex flex-wrap justify-center sm:justify-start gap-6 pt-3 text-sm">
              <div>
                <span className="font-bold text-stone-900">{spots.length}</span>{' '}
                <span className="text-stone-600 text-xs">bài trải nghiệm</span>
              </div>
              <div>
                <span className="font-bold text-stone-900">{privatePlaces.length}</span>{' '}
                <span className="text-stone-600 text-xs">địa điểm riêng tư</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/spots/new')}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Spot</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex border-b border-stone-200 gap-6">
          <button
            onClick={() => setActiveTab('spots')}
            className={`text-sm font-bold pb-3 relative transition-colors flex items-center gap-2 ${
              activeTab === 'spots' ? 'text-orange-600' : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Nhật ký của tôi ({spots.length})</span>
            {activeTab === 'spots' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('private_places')}
            className={`text-sm font-bold pb-3 relative transition-colors flex items-center gap-2 ${
              activeTab === 'private_places' ? 'text-orange-600' : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Địa điểm riêng tư ({privatePlaces.length})</span>
            {activeTab === 'private_places' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Danh sách bài Spot của tôi */}
        {activeTab === 'spots' && (
          <div>
            {loading ? (
              <div className="py-12 text-center text-sm text-stone-600">Đang tải bài viết...</div>
            ) : spots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {spots.map((spot) => (
                  <SpotCard
                    key={spot.id}
                    spot={spot}
                    authorProfile={{
                      displayName: profile?.displayName || 'Bạn',
                      avatarPath: profile?.avatarPath || null,
                    }}
                    onDeleted={(id) => setSpots(spots.filter((s) => s.id !== id))}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                <p className="text-sm font-semibold text-stone-700">Bạn chưa có bài trải nghiệm nào</p>
                <button
                  onClick={() => router.push('/spots/new')}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Đăng Spot đầu tiên
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Danh sách địa điểm riêng tư */}
        {activeTab === 'private_places' && (
          <div>
            {privatePlaces.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {privatePlaces.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">{p.name}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                        Chỉ bạn thấy
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-1">{p.address}</p>
                    <div className="text-[11px] text-stone-600 font-mono">
                      {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
                <Lock className="w-8 h-8 text-stone-300 mx-auto mb-1" />
                <p className="text-sm font-semibold text-stone-700">Chưa có địa điểm riêng tư nào</p>
                <p className="text-xs text-stone-600">
                  Khi tạo địa điểm mới tại bước tạo Spot, bạn có thể chọn chế độ &quot;Riêng tư&quot; để chỉ tài khoản này mới thấy.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
