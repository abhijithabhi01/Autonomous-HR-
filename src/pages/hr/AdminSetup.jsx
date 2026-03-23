// src/pages/hr/AdminSetup.jsx
// Create IT admin and HR admin accounts from within the HR portal.
import { useState } from 'react'
import { useCreateITAdmin, useCreateHRAdmin } from '../../hooks/useData'
import toast from 'react-hot-toast'

function AdminForm({ title, icon, accentColor, description, onCreate, isPending }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [done, setDone] = useState(null) // null | { email, uid }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('All fields are required')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      const result = await onCreate(form)
      setDone({ email: form.email, uid: result.uid, note: result.note })
      toast.success(`${title} account created!`)
      setForm({ name: '', email: '', password: '' })
    } catch (err) {
      toast.error(err.message || 'Failed to create account')
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden`}
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

      {/* Form */}
      <div className="p-6">
        {done && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
            <span className="text-lg flex-shrink-0 mt-0.5">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Account created</p>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="text-white font-medium">{done.email}</span> can now log in.
              </p>
              {done.note && <p className="text-xs text-amber-400 mt-0.5">{done.note}</p>}
              <p className="text-xs text-slate-500 mt-1">UID: {done.uid}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={`e.g. ${title === 'IT Admin' ? 'Arjun Thomas' : 'Priya Sharma'}`}
              className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={`e.g. it@dcompany.com`}
              className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-12 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-sm">
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {form.password && form.password.length < 8 && (
              <p className="text-xs text-red-400 mt-1">Password too short ({form.password.length}/8)</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || form.password.length < 8}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: accentColor, boxShadow: `0 0 16px ${accentColor}40` }}>
            {isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : `Create ${title} Account`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminSetup() {
  const createIT = useCreateITAdmin()
  const createHR = useCreateHRAdmin()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-7 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Admin Setup</h1>
        <p className="text-slate-500 text-sm mt-1">Create login accounts for IT and HR administrators</p>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/15 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards' }}>
        <span className="text-lg flex-shrink-0 mt-0.5">ℹ️</span>
        <div>
          <p className="text-sm font-semibold text-indigo-300">How admin accounts work</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Admins log in at the same <code className="text-indigo-300">/login</code> page as candidates.
            The system reads their <code className="text-indigo-300">role</code> from Firestore and routes them automatically —
            HR admins go to <code className="text-indigo-300">/hr</code>, IT admins go to <code className="text-indigo-300">/it</code>.
          </p>
        </div>
      </div>

      {/* Two forms side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up opacity-0"
        style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>

        <AdminForm
          title="IT Admin"
          icon="🖥️"
          accentColor="#22D3EE"
          description="Access to IT provisioning portal at /it"
          onCreate={(data) => createIT.mutateAsync(data)}
          isPending={createIT.isPending}
        />

        <AdminForm
          title="HR Admin"
          icon="🏢"
          accentColor="#818CF8"
          description="Access to HR dashboard at /hr"
          onCreate={(data) => createHR.mutateAsync(data)}
          isPending={createHR.isPending}
        />
      </div>

      {/* Existing roles reference */}
      <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-slide-up opacity-0"
        style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Role → Route mapping</p>
        <div className="space-y-2">
          {[
            { role: 'hr',       icon: '🏢', route: '/hr',         color: 'text-indigo-400',  desc: 'Full HR dashboard — candidates, employees, alerts' },
            { role: 'it_admin', icon: '🖥️', route: '/it',         color: 'text-cyan-400',    desc: 'IT provisioning requests' },
            { role: 'employee', icon: '👤', route: '/onboarding', color: 'text-emerald-400', desc: 'Candidate onboarding portal' },
          ].map(r => (
            <div key={r.role} className="flex items-center gap-3 text-xs">
              <span>{r.icon}</span>
              <code className={`font-mono font-bold w-16 ${r.color}`}>{r.role}</code>
              <span className="text-slate-600">→</span>
              <code className="text-slate-400 font-mono">{r.route}</code>
              <span className="text-slate-600 hidden sm:block">— {r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}