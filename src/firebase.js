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

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const FIREBASE_READY = Object.values(firebaseConfig).every(Boolean);

let _app, _auth, _db;

if (FIREBASE_READY) {
  _app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db   = getFirestore(_app);
}

export const auth = _auth;
export const db   = _db;

export const signInWithGoogle = () => {
  if (!FIREBASE_READY) return Promise.reject(new Error("Firebase not configured."));
  return signInWithPopup(_auth, new GoogleAuthProvider());
};

export const signOutUser = () => {
  if (!FIREBASE_READY) return Promise.resolve();
  return signOut(_auth);
};

export const watchAuthState = (callback) => {
  if (!FIREBASE_READY) { callback(null); return () => {}; }
  return onAuthStateChanged(_auth, callback);
};

export const saveGame = async (uid, gameId, title, state) => {
  if (!FIREBASE_READY || !_db) throw new Error("Firebase not configured.");
  const ref = doc(_db, "users", uid, "games", gameId);
  await setDoc(ref, {
    title: title || "Untitled Game",
    savedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
    data: JSON.stringify(state),
  });
};

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

export const deleteGame = async (uid, gameId) => {
  if (!FIREBASE_READY || !_db) return;
  await deleteDoc(doc(_db, "users", uid, "games", gameId));
};
