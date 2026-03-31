// src/pages/it/AdminSetup.jsx
// Creates IT admin and HR admin accounts directly in Firebase Authentication.
// Uses a secondary Firebase app instance so the current IT admin session
// is never interrupted by createUserWithEmailAndPassword.

import { useState } from 'react'
import { initializeApp, deleteApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import toast from 'react-hot-toast'

// ── Firebase config (re-used from env vars) ───────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── Create a user without touching the current auth session ───
// A temporary secondary Firebase app is spun up, used to call
// createUserWithEmailAndPassword, then immediately deleted.
async function createAdminInFirebase({ name, email, password, role }) {
  const appName    = `admin-temp-${Date.now()}`
  const secondary  = initializeApp(firebaseConfig, appName)
  const tempAuth   = getAuth(secondary)

  try {
    // 1. Create the Auth user
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password)
    const uid  = cred.user.uid

    // 2. Write the Firestore profile (uses the main db — same project)
    const avatar = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    await setDoc(doc(db, 'profiles', uid), {
      email,
      name,
      role,
      avatar,
      candidate_id: null,
      employee_id:  null,
      created_at:   new Date().toISOString(),
    })

    return { uid, email }
  } finally {
    // Always clean up the secondary app regardless of success / failure
    await deleteApp(secondary)
  }
}

// ── Single form component ─────────────────────────────────────
function AdminForm({ title, icon, accentColor, description, role }) {
  const [form,     setForm]     = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [created,  setCreated]  = useState(null) // { uid, email }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { name, email, password } = form
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('All fields are required')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      // Check if a profile with this email already exists in Firestore
      // (We can't query Auth from the client, but a duplicate will throw
      //  auth/email-already-in-use which we handle below.)
      const result = await createAdminInFirebase({ name, email, password, role })
      setCreated(result)
      toast.success(`${title} account created!`)
      setForm({ name: '', email: '', password: '' })
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists.')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Invalid email address.')
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password is too weak — use at least 8 characters.')
      } else {
        toast.error(err.message || 'Failed to create account')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${accentColor}25`, background: `${accentColor}08` }}>

      {/* Header */}
      <div className="px-6 py-5 border-b" style={{ borderColor: `${accentColor}15` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
            {icon}
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-base">{title}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">

        {/* Success banner */}
        {created && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
            <span className="text-lg flex-shrink-0 mt-0.5">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Account created in Firebase</p>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="text-white font-medium">{created.email}</span> can now log in at <code className="text-cyan-300">/login</code>.
              </p>
              <p className="text-xs text-slate-600 mt-1">UID: {created.uid}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={title === 'IT Admin' ? 'e.g. Arjun Thomas' : 'e.g. Priya Sharma'}
              className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="e.g. it@company.com"
              className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-12 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-sm">
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {form.password && form.password.length < 8 && (
              <p className="text-xs text-red-400 mt-1">Password too short ({form.password.length}/8)</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || form.password.length < 8}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: accentColor, boxShadow: `0 0 16px ${accentColor}40` }}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : `Create ${title} Account`}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminSetup() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-7 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Admin Setup</h1>
        <p className="text-slate-500 text-sm mt-1">Create login accounts for IT and HR administrators</p>
      </div>



      {/* Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up opacity-0"
        style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>

        <AdminForm
          title="IT Admin"
          icon="🖥️"
          accentColor="#22D3EE"
          description="Access to IT provisioning portal at /it"
          role="it_admin"
        />

        <AdminForm
          title="HR Admin"
          icon="🏢"
          accentColor="#818CF8"
          description="Access to HR dashboard at /hr"
          role="hr"
        />
      </div>

    </div>
  )
}