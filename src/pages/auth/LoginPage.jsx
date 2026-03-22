import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Route user based on their role from Firestore profile
  const go = (user) => {
    if      (user.role === 'hr')       navigate('/hr')
    else if (user.role === 'it_admin') navigate('/it')
    else                               navigate('/onboarding')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim())    { toast.error('Enter your email');    return }
    if (!password.trim()) { toast.error('Enter your password'); return }
    try {
      const user = await login(email.trim(), password)
      toast.success('Welcome, ' + user.name.split(' ')[0] + '!')
      go(user)
    } catch (err) {
      // Surface friendly Firebase Auth error messages
      const msg = err.code === 'auth/invalid-credential'    ? 'Incorrect email or password.' :
                  err.code === 'auth/user-not-found'        ? 'No account found with this email.' :
                  err.code === 'auth/wrong-password'        ? 'Incorrect password.' :
                  err.code === 'auth/too-many-requests'     ? 'Too many attempts. Try again later.' :
                  err.code === 'auth/network-request-failed'? 'Network error. Check your connection.' :
                  err.message || 'Login failed'
      toast.error(msg)
    }
  }

  

  return (
    <div className="min-h-screen bg-[#050E10] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-72 sm:w-[500px] h-72 sm:h-[500px] bg-teal-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-96 h-56 sm:h-96 bg-cyan-600/6 rounded-full blur-3xl" />
        <div className="absolute top-3/4 left-1/4 w-40 sm:w-64 h-40 sm:h-64 bg-emerald-600/5 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-sm sm:max-w-[420px] relative z-10 animate-fade-in">

        {/* Brand */}
        <div className="text-center mb-6 sm:mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4"
            style={{ boxShadow: '0 0 32px rgba(20,184,166,0.2)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#2DD4BF"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
           D Company<br />Onboarding Platform
          </h1>
          
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-teal-500/10 bg-[#0C1A1D]/80 backdrop-blur-sm p-6 sm:p-8"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.06), 0 24px 48px rgba(0,0,0,0.6)' }}>
<p className="text-slate-500 text-sm mt-2 mb-4 text-center text-white">Sign in to continue</p>
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                className="w-full bg-[#060F12] border border-white/[0.08] rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full bg-[#060F12] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors p-1">
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
              style={{ boxShadow: loading ? 'none' : '0 0 24px rgba(20,184,166,0.3)' }}>
              {loading
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Sign in'}
            </button>
          </form>

        </div>


      </div>
    </div>
  )
}