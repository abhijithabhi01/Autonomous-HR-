// src/hooks/useAuth.js
// Handles login/logout only — Firebase Auth runs client-side for session management.
// signUp is handled by the backend (POST /api/candidates) using Admin SDK.

import { createElement, createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
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
  const login = async (email, password) => {
    setLoading(true)
    try {
      const cred    = await signInWithEmailAndPassword(auth, email, password || 'Demo1234!')
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

  // ── logout ───────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  const value = { user, loading, login, logout }
  return createElement(AuthContext.Provider, { value }, children)
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}