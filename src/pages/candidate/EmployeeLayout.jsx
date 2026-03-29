import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCandidate, useChecklist } from '../../hooks/useData'
import Avatar from '../../components/shared/Avatar'
import ProgressBar from '../../components/shared/ProgressBar'

// ── Nav items ─────────────────────────────────────────────────
// We define two sets:
//   NAV_FULL    — shown BEFORE final submit (all separate steps)
//   NAV_DONE    — shown AFTER final submit  (steps collapsed into "My Summary")
const NAV_FULL = [
  { to: '/onboarding', label: 'Welcome', icon: '🎊', exact: true },
  { to: '/onboarding/profile', label: 'Profile', icon: '👤' },
  { to: '/onboarding/terms', label: 'Terms', icon: '📋' },
  { to: '/onboarding/documents', label: 'Documents', icon: '📄' },
  { to: '/onboarding/checklist', label: 'Checklist', icon: '✅' },
  { to: '/onboarding/policy', label: 'Ask HR Bot', icon: '💬' },
]

const NAV_DONE = [
  { to: '/onboarding', label: 'Welcome', icon: '🎊', exact: true },
  { to: '/onboarding/review', label: 'My Summary', icon: '🪪' },
  { to: '/onboarding/checklist', label: 'Checklist', icon: '✅' },
  { to: '/onboarding/policy', label: 'Ask HR Bot', icon: '💬' },
]

// ── Sign-out confirm modal ────────────────────────────────────
function SignOutModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl"
        style={{ animation: 'slideUp 0.2s ease-out both' }}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-white text-lg mb-1">Sign out?</h2>
          <p className="text-slate-400 text-sm">Your progress is saved and you can continue anytime.</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all disabled:opacity-50">
            Keep working
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Sign out'}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function EmployeeLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Live data — real job title + progress
  const { data: emp } = useCandidate(user?.candidate_id)
  const { data: items = [] } = useChecklist(user?.candidate_id)

  const progress = emp?.onboarding_progress ?? 0
  const jobTitle = emp?.position ?? ''

  // ID Card Issued = system-side confirmation that final submit completed
  const idCardItem = items.find(i => i.title === 'ID Card Issued')
  const isSubmitted = idCardItem?.completed ?? false

  // Choose nav set
  const NAV = isSubmitted ? NAV_DONE : NAV_FULL

  const handleSignOut = async () => {
    setSigningOut(true)
    await logout()
    navigate('/login')
  }


  return (
    <div className="flex h-screen bg-[#070B15] overflow-hidden">

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setDrawerOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-60 flex-shrink-0 flex flex-col bg-[#0A0E1A] border-r border-white/[0.05]
        transform transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 0 16px rgba(99,102,241,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#818CF8" />
              </svg>
            </div>
            <div>
              <p className="font-display font-bold text-white text-base leading-none">D Company</p>
              <p className="text-xs text-slate-600 mt-0.5">Onboarding Portal</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress pill */}
        <div className="mx-3 my-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
          <p className="text-xs text-slate-500 mb-2">Your progress</p>
          <ProgressBar value={progress} showLabel={false} size="sm" />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-slate-400">{progress}% complete</p>
            {isSubmitted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-400 font-semibold">
                ✓ Submitted
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest px-3 mb-3">
            My Onboarding
          </p>

          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`
              }>
              <span>{item.icon}</span>
              {item.label}
              {/* Badge on My Summary when just submitted */}
              {item.label === 'My Summary' && isSubmitted && (
                <span className="ml-auto w-2 h-2 rounded-full bg-teal-400" />
              )}
            </NavLink>
          ))}

          {/* Divider hint when collapsed */}
          {isSubmitted && (
            <p className="text-[10px] text-slate-700 px-3 pt-2 pb-1">
              Profile · Terms · Documents are in My Summary
            </p>
          )}
        </nav>

        {/* User row */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl group hover:bg-white/[0.03] transition-colors">

            {emp?.profile_photo_url ? (
              <img
                src={emp.profile_photo_url}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border border-white/[0.08]"
              />
            ) : (
              <Avatar initials={user?.avatar || 'ME'} size="sm" index={1} />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-300 truncate leading-none">{user?.name || 'Employee'}</p>

            </div>
            <button
              onClick={() => setSignOutOpen(true)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Sign out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#0A0E1A] border-b border-white/[0.05] flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-display font-bold text-white text-sm">D Company</span>
          <div className="ml-auto flex items-center gap-2">
            {isSubmitted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-400 font-semibold">
                ✓ Submitted
              </span>
            )}
            <div className="w-20"><ProgressBar value={progress} showLabel={false} size="sm" /></div>
            <span className="text-xs text-slate-500">{progress}%</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Sign-out modal */}
      {signOutOpen && (
        <SignOutModal
          loading={signingOut}
          onConfirm={handleSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}
    </div>
  )
}