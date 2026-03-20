// src/hooks/useAuth.js
// Uses React Context so auth state is shared across the whole app.
// Uses createElement (not JSX) so this .js file parses cleanly in Vite.

import { createElement, createContext, useContext, useState, useEffect } from 'react'
import { initializeApp, getApps }                                        from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, getFirestore } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

// ── Secondary Firebase app ────────────────────────────────────
// Returns { auth, db } for the isolated secondary instance.
// Lazy — only created on first signUp() call.
//
// KEY FIX: we also grab the secondary app's Firestore instance so that
// when we write the profile doc, Firestore security rules evaluate
// request.auth.uid as the NEW candidate (not the HR admin).
// If we used the primary db after signOut() the write would be
// authenticated as HR admin and fail with PERMISSION_DENIED.
let _secondary = null
function getSecondary() {
  if (_secondary) return _secondary

  const existing = getApps().find(a => a.name === 'secondary')
  const app = existing || initializeApp(
    {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    },
    'secondary'
  )

  _secondary = {
    auth: getAuth(app),
    db:   getFirestore(app),   // ← secondary Firestore — uses secondary auth for rule evaluation
  }
  return _secondary
}

// ── Profile resolver ──────────────────────────────────────────
async function resolveProfile(firebaseUser) {
  if (!firebaseUser) return null
  try {
    const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
    if (!snap.exists()) {
      console.warn('[auth] No profile found for uid:', firebaseUser.uid)
      return null
    }
    const p = snap.data()
    return {
      id:           firebaseUser.uid,
      email:        p.email        || firebaseUser.email,
      name:         p.name         || '',
      role:         p.role         || 'employee',
      avatar:       p.avatar       || '',
      candidate_id: p.candidate_id || null,
      employee_id:  p.employee_id  || null,
    }
  } catch (err) {
    console.error('[auth] resolveProfile error:', err.message)
    return null
  }
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(await resolveProfile(firebaseUser))
      setLoading(false)
    })
    return unsub
  }, [])

  // ── login ────────────────────────────────────────────────────
  const login = async (email, _password) => {
    setLoading(true)
    try {
      const cred    = await signInWithEmailAndPassword(auth, email, _password || 'Demo1234!')
      const appUser = await resolveProfile(cred.user)
      if (!appUser) {
        // Auth account exists but profile is missing — surface a clear error
        await signOut(auth)
        throw Object.assign(
          new Error('Your account is not fully set up yet. Please contact HR.'),
          { code: 'auth/profile-missing' }
        )
      }
      setUser(appUser)
      return appUser
    } finally {
      setLoading(false)   // always runs — even on bad credentials
    }
  }

  // ── quickLogin ───────────────────────────────────────────────
  const quickLogin = async (role) => {
    const emails = { hr: 'hr@Dcompany.com', employee: 'aisha.rahman@Dcompany.com' }
    return login(emails[role], 'Demo1234!')
  }

  // ── logout ───────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  // ── signUp ───────────────────────────────────────────────────
  // Called by useAddCandidate when HR adds a new candidate.
  //
  // CRITICAL ORDER:
  //   1. createUserWithEmailAndPassword  → secondary auth (HR session untouched)
  //   2. setDoc profile                 → secondary db (new user is authenticated → rules pass)
  //   3. signOut secondary              → AFTER the write, not before
  //
  // Previous code signed out BEFORE writing the profile, so Firestore
  // evaluated request.auth.uid as the HR admin UID, not the candidate UID.
  // That broke `allow write: if request.auth.uid == userId` rules silently.
  const signUp = async ({ email, password, name, role, candidate_id, employee_id }) => {
    const { auth: secondaryAuth, db: secondaryDb } = getSecondary()

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid  = cred.user.uid

    const avatar = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

    // Write profile while the new user IS authenticated in the secondary app
    await setDoc(doc(secondaryDb, 'profiles', uid), {
      email,
      name,
      role:         role         || 'employee',
      avatar,
      candidate_id: candidate_id || null,
      employee_id:  employee_id  || null,
      created_at:   new Date().toISOString(),
    })

    // Sign out AFTER the profile write succeeds
    await signOut(secondaryAuth)
    return uid
  }

  // ── updateProfile ────────────────────────────────────────────
  const updateProfile = async (uid, fields) => {
    await updateDoc(doc(db, 'profiles', uid), fields)
  }

  const value = { user, loading, login, quickLogin, logout, signUp, updateProfile }
  return createElement(AuthContext.Provider, { value }, children)
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}