/**
 * Firebase initialization module with singleton pattern.
 * Works in both client (browser) and server (Node.js) environments.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration
// In production, these should come from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD7Mgo2V8V-ihzqPRIWRzGdO5LVJiKw_cI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "channelsignal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "channelsignal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "channelsignal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "901407023126",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:901407023126:web:f1eb8295cae0b8ad339537",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-PJJ0MNSQHX",
};

/**
 * Get or initialize the Firebase app instance.
 * Uses singleton pattern to avoid multiple initializations.
 */
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

// Initialize Firebase app
const app = getFirebaseApp();

// Initialize Firestore
const db: Firestore = getFirestore(app);

export { app, db, firebaseConfig };
export type { FirebaseApp, Firestore };
