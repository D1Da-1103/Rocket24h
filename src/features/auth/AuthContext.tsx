'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { UserProfile, UserSettings } from '@/lib/domain/types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const loadUserData = async (currentUser: FirebaseUser) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile({
          uid: currentUser.uid,
          displayName: data.displayName || currentUser.displayName || 'Thành viên',
          avatarPath: data.avatarPath || currentUser.photoURL || null,
          createdAt: data.createdAt,
        });
      } else {
        // Tự phục hồi: nếu auth tồn tại mà profile chưa có
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Thành viên mới',
          avatarPath: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }

      // Tải settings
      const settingsRef = doc(db, 'userSettings', currentUser.uid);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as UserSettings);
      } else {
        const defaultSettings: UserSettings = {
          defaultVisibility: 'friends',
          notificationEnabled: true,
        };
        await setDoc(settingsRef, defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu người dùng:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      startTransition(async () => {
        setUser(currentUser);
        if (currentUser) {
          await loadUserData(currentUser);
        } else {
          setProfile(null);
          setSettings(null);
        }
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const u = cred.user;

    await updateProfile(u, { displayName });

    const newProfile: UserProfile = {
      uid: u.uid,
      displayName,
      avatarPath: null,
      createdAt: serverTimestamp(),
    };

    // Ghi hồ sơ vào Firestore
    await setDoc(doc(db, 'users', u.uid), newProfile);

    // Ghi cài đặt mặc định
    await setDoc(doc(db, 'userSettings', u.uid), {
      defaultVisibility: 'friends',
      notificationEnabled: true,
    });

    setProfile(newProfile);
  };

  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    setProfile(null);
    setSettings(null);
  };

  const updateDisplayName = async (newName: string) => {
    if (!user) throw new Error('Chưa đăng nhập');
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { displayName: newName }, { merge: true });
    await updateProfile(user, { displayName: newName });
    setProfile((prev) => (prev ? { ...prev, displayName: newName } : null));
  };

  const updateAvatar = async (avatarUrl: string) => {
    if (!user) throw new Error('Chưa đăng nhập');
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { avatarPath: avatarUrl }, { merge: true });
    await updateProfile(user, { photoURL: avatarUrl });
    setProfile((prev) => (prev ? { ...prev, avatarPath: avatarUrl } : null));
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        settings,
        loading,
        login,
        register,
        logout,
        updateDisplayName,
        updateAvatar,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
}
