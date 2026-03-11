// src/hooks/useAuth.js
// Drop-in replacement for the mock useAuth hook.
// Uses Supabase Auth + profiles table.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Resolve Supabase session → app user object ──────────────
  const resolveUser = async (session) => {
    if (!session) { setUser(null); setLoading(false); return }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error || !profile) {
      setUser(null)
    } else {
      setUser({
        id:          session.user.id,
        email:       profile.email,
        name:        profile.name,
        role:        profile.role,
        avatar:      profile.avatar,
        candidate_id: profile.candidate_id ?? null,
        employee_id:  profile.employee_id  ?? null,
      })
    }
    setLoading(false)
  }

  // ── Listen for auth state changes ───────────────────────────
  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveUser(session)
    })

    // Subscribe to future changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── login ───────────────────────────────────────────────────
  const login = async (email, _password, role) => {
    setLoading(true)

    // For demo: use a fixed password "Demo1234!" regardless of what's typed.
    // In production, pass the real password through.
    const password = _password || 'Demo1234!'

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoading(false); throw error }

    // resolveUser will be called by onAuthStateChange, but we return early here
    // so the caller can navigate immediately.
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const appUser = {
      id:          data.user.id,
      email:       profile.email,
      name:        profile.name,
      role:        profile.role ?? role,
      avatar:      profile.avatar,
      candidate_id: profile.candidate_id ?? null,
        employee_id:  profile.employee_id  ?? null,
    }
    setUser(appUser)
    setLoading(false)
    return appUser
  }

  // ── quickLogin (demo buttons) ───────────────────────────────
  const quickLogin = async (role) => {
    const emails = { hr: 'hr@Dcompany.com', employee: 'aisha.rahman@Dcompany.com' }
    return login(emails[role], 'Demo1234!', role)
  }

  // ── logout ──────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, login, quickLogin, logout }
}