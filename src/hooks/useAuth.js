// src/hooks/useAuth.js
// Uses React Context so auth state is shared across the whole app.
// Uses createElement (not JSX) so this .js file parses cleanly in Vite.

import { createElement, createContext, useContext, useState, useEffect } from 'react'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

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
        await signOut(auth)
        throw Object.assign(
          new Error('Your account is not fully set up yet. Please contact HR.'),
          { code: 'auth/profile-missing' }
        )
      }
      setUser(appUser)
      return appUser
    } finally {
      setLoading(false)
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
  // Uses the Firebase REST API instead of the SDK.
  //
  // WHY REST API?
  //   The SDK approach (secondary Firebase app) had a race condition:
  //   after createUserWithEmailAndPassword the secondary Firestore
  //   instance hadn't registered the new user's auth token yet, so the
  //   profile setDoc hit PERMISSION_DENIED → auth account created but
  //   no profile → "auth/email-already-in-use" on next attempt.
  //
  //   The REST API returns the idToken immediately in the response body.
  //   We pass it explicitly in the Firestore REST request, so there is
  //   zero race condition and the security rule `request.auth.uid == uid`
  //   is always satisfied.
  //
  //   This also means we never touch the SDK auth state → HR stays
  //   signed in throughout.
  const signUp = async ({ email, password, name, role, candidate_id, employee_id }) => {
    const API_KEY    = import.meta.env.VITE_FIREBASE_API_KEY
    const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID

    // 1. Create Firebase Auth account
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )
    const signUpData = await signUpRes.json()

    if (!signUpRes.ok) {
      // Normalise to Firebase SDK-style error codes so callers can switch on err.code
      const raw  = signUpData.error?.message || 'UNKNOWN'
      const code = 'auth/' + raw.toLowerCase().replace(/_/g, '-')
      throw Object.assign(new Error(raw), { code })
    }

    const uid     = signUpData.localId
    const idToken = signUpData.idToken   // ← available immediately, no race condition
    const avatar  = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

    // 2. Write Firestore profile using the new user's ID token
    //    Satisfies `request.auth.uid == uid` rule regardless of SDK state
    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
      `/databases/(default)/documents/profiles/${uid}`

    const profileRes = await fetch(firestoreUrl, {
      method:  'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        fields: {
          email:        { stringValue: email },
          name:         { stringValue: name },
          role:         { stringValue: role || 'employee' },
          avatar:       { stringValue: avatar },
          candidate_id: candidate_id ? { stringValue: candidate_id } : { nullValue: null },
          employee_id:  employee_id  ? { stringValue: employee_id  } : { nullValue: null },
          created_at:   { stringValue: new Date().toISOString() },
        },
      }),
    })

    if (!profileRes.ok) {
      const err = await profileRes.json().catch(() => ({}))
      throw new Error('Profile write failed: ' + (err.error?.message || profileRes.status))
    }

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