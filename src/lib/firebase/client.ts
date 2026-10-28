import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key-for-local-emulator',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'rocket24h-local.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rocket24h-local',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'rocket24h-local.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
};

// Singleton app instance
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Chỉ kết nối Emulator khi được bật tường minh bằng biến môi trường.
let emulatorsConnected = false;

if (typeof window !== 'undefined' && !emulatorsConnected) {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  if (useEmulator) {
    try {
      // @ts-expect-error internal flag to prevent re-attaching emulator
      if (!window.__EMULATORS_CONNECTED__) {
        const authHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || 'localhost:9099';
        const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
        const storageHost = process.env.NEXT_PUBLIC_STORAGE_EMULATOR_HOST || 'localhost:9199';

        const [fHost, fPort] = firestoreHost.split(':');
        const [sHost, sPort] = storageHost.split(':');

        connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
        connectFirestoreEmulator(db, fHost, parseInt(fPort || '8080', 10));
        connectStorageEmulator(storage, sHost, parseInt(sPort || '9199', 10));

        // @ts-expect-error window cache flag
        window.__EMULATORS_CONNECTED__ = true;
        emulatorsConnected = true;
      }
    } catch {
      // Bỏ qua lỗi nếu đã kết nối trước đó (trong HMR)
    }
  }
}

export { app, auth, db, storage };
