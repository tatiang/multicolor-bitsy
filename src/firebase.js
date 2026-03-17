// ─── Firebase Configuration ───────────────────────────────────────────────────
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com and create a project (or open existing)
// 2. In Project Settings → General → Your apps, click the </> web icon to add a web app
// 3. Copy the firebaseConfig object values into the fields below
// 4. In Firebase Console → Authentication → Sign-in method, enable "Google"
// 5. In Firebase Console → Firestore Database, create a database (start in test mode or
//    use production mode with the security rules below)
//
// FIRESTORE SECURITY RULES (paste into Firebase Console → Firestore → Rules):
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /users/{userId}/games/{gameId} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

// ── Replace these with your Firebase project's config values ──────────────────
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID",
};

// True only when all config values have been filled in
export const FIREBASE_READY = !Object.values(firebaseConfig).some((v) =>
  v.startsWith("REPLACE_")
);

let _app, _auth, _db;

if (FIREBASE_READY) {
  _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

export const auth = _auth;
export const db = _db;

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const signInWithGoogle = () => {
  if (!FIREBASE_READY) return Promise.reject(new Error("Firebase is not configured."));
  return signInWithPopup(_auth, new GoogleAuthProvider());
};

export const signOutUser = () => {
  if (!FIREBASE_READY) return Promise.resolve();
  return signOut(_auth);
};

/** Returns an unsubscribe function. callback receives Firebase User or null. */
export const watchAuthState = (callback) => {
  if (!FIREBASE_READY) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, callback);
};

// ── Firestore helpers ─────────────────────────────────────────────────────────

/**
 * Save (create or overwrite) a game document.
 * @param {string} uid    Firebase Auth user ID
 * @param {string} gameId Arbitrary document ID (uid() from app, or existing save ID)
 * @param {string} title  Human-readable game title
 * @param {object} state  Plain-JS object of all serialisable game state
 */
export const saveGame = async (uid, gameId, title, state) => {
  if (!FIREBASE_READY || !_db) throw new Error("Firebase is not configured.");
  const ref = doc(_db, "users", uid, "games", gameId);
  await setDoc(ref, {
    title: title || "Untitled Game",
    savedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
    data: JSON.stringify(state),
  });
};

/**
 * Load all saved games for a user (max 20, newest first).
 * @returns {Array<{id, title, updatedAt, data}>}
 */
export const loadAllGames = async (uid) => {
  if (!FIREBASE_READY || !_db) return [];
  const q = query(
    collection(_db, "users", uid, "games"),
    orderBy("savedAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** Delete a single saved game document. */
export const deleteGame = async (uid, gameId) => {
  if (!FIREBASE_READY || !_db) return;
  await deleteDoc(doc(_db, "users", uid, "games", gameId));
};
