import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

// Chỉ dùng Emulator khi được bật tường minh bằng biến môi trường.
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rocket24h-local';

const adminApp: App = getApps().length > 0
  ? getApp()
  : initializeApp({
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);
export { FieldValue, Timestamp };
