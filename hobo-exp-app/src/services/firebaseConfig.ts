/**
 * Firebase configuration
 * Replace the values below with your actual Firebase project config.
 * Find them in: Firebase Console → Project Settings → Your apps → Web app config
 */
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD2OAnajHgwL1o8hSkyeYEgtsghb4c-LuQ',
  authDomain: 'hobo-experience.firebaseapp.com',
  databaseURL: 'https://hobo-experience-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hobo-experience',
  storageBucket: 'hobo-experience.firebasestorage.app',
  messagingSenderId: '889986791706',
  appId: '1:889986791706:web:31de08321ba62eb816d4a3',
  measurementId: 'G-FZDWGNC98Y',
};

// Initialize only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
