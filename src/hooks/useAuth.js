// src/hooks/useAuth.js
// Auth via React Context + Firebase Auth.
// NOTE: Uses React.createElement instead of JSX so this .js file is valid
//       without Vite needing to transform JSX in non-.jsx files.
//
// Exports:
//   AuthProvider  — wrap the app with this (in main.jsx)
//   useAuth       — call inside any component

import { createElement, createContext, useContext, useState, useEffect } from 'react'
import { initializeApp, getApps }                                        from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db }                       from '../lib/firebase'

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Secondary app — lazy singleton ────────────────────────────
// Initialised only when signUp() is first called, never at module load time.
// Keeps the HR admin's primary session completely untouched.
let _secondaryAuth = null
function getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth
  const existing = getApps().find(a => a.name === 'secondary')
  if (existing) {
    _secondaryAuth = getAuth(existing)
    return _secondaryAuth
  }
  const cfg = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  }
  _secondaryAuth = getAuth(initializeApp(cfg, 'secondary'))
  return _secondaryAuth
}

// ── Profile resolver ──────────────────────────────────────────
async function resolveProfile(firebaseUser) {
  if (!firebaseUser) return null
  const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
  if (!snap.exists()) return null
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
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(await resolveProfile(firebaseUser))
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email, _password) => {
    setLoading(true)
    const cred    = await signInWithEmailAndPassword(auth, email, _password || 'Demo1234!')
    const appUser = await resolveProfile(cred.user)
    setUser(appUser)
    setLoading(false)
    return appUser
  }

  const quickLogin = async (role) => {
    const emails = { hr: 'hr@Dcompany.com', employee: 'aisha.rahman@Dcompany.com' }
    return login(emails[role], 'Demo1234!')
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  const signUp = async ({ email, password, name, role, candidate_id, employee_id }) => {
    const secondaryAuth = getSecondaryAuth()
    const cred          = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid           = cred.user.uid
    await signOut(secondaryAuth)   // drop secondary session immediately

    const avatar = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    await setDoc(doc(db, 'profiles', uid), {
      email,
      name,
      role:         role         || 'employee',
      avatar,
      candidate_id: candidate_id || null,
      employee_id:  employee_id  || null,
      created_at:   new Date().toISOString(),
    })
    return uid
  }

  const updateProfile = async (uid, fields) => {
    await updateDoc(doc(db, 'profiles', uid), fields)
  }

  const value = { user, loading, login, quickLogin, logout, signUp, updateProfile }

  // ── No JSX — use createElement so this .js file parses cleanly in Vite ──
  return createElement(AuthContext.Provider, { value }, children)
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}