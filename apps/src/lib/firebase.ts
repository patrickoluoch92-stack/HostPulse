import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
}

function readConfig(): FirebaseRuntimeConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };
}

function validateConfig(config: FirebaseRuntimeConfig): string[] {
  const required: Array<keyof FirebaseRuntimeConfig> = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
  ];
  return required.filter((key) => !config[key]);
}

const firebaseConfig = readConfig();
const missing = validateConfig(firebaseConfig);

export const firebaseEnabled = missing.length === 0;
export const firebaseStatusMessage = firebaseEnabled
  ? 'Firebase is configured'
  : `Firebase disabled: missing ${missing.join(', ')}`;

const firebaseApp: FirebaseApp | null = firebaseEnabled
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export { firebaseApp };

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseFirestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseRealtimeDb = firebaseApp ? getDatabase(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

export function ensureFirebaseInitialized(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error(firebaseStatusMessage);
  }
  return firebaseApp;
}

export function getFirebaseAuth() {
  return firebaseAuth;
}

export function getFirestoreClient() {
  return firebaseFirestore;
}

export function getRealtimeDbClient() {
  return firebaseRealtimeDb;
}

export function getStorageClient() {
  return firebaseStorage;
}

// Backward-compatible aliases for existing app imports.
export const getFirestoreInstance = getFirestoreClient;
export const getRealtimeDatabaseInstance = getRealtimeDbClient;
export const getStorageInstance = getStorageClient;

