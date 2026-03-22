import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAlerts, useCandidates, useRealtimeSync } from '../../hooks/useData'
import Avatar from '../../components/shared/Avatar'

const NAV = [
  { to: '/hr',             label: 'Dashboard',  icon: '⬡', exact: true },
  { to: '/hr/employees',   label: 'Employees',  icon: '◉' },
  { to: '/hr/candidates',  label: 'Candidates', icon: '◈', candidateBadge: true },
  { to: '/hr/alerts',      label: 'Alerts',     icon: '◎', badge: true },
]

// ── Sign-out confirm modal ────────────────────────────────────
function SignOutModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl"
        style={{ animation: 'slideUp 0.2s ease-out both' }}>
        <div className="p-6 text-center">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-white text-lg mb-1">Sign out?</h2>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all disabled:opacity-50">
            Stay signed in
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
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

// ── Sidebar content ───────────────────────────────────────────
function SidebarContent({ user, alertCount, candidateCount, onSignOutClick, onClose }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: '0 0 16px rgba(99,102,241,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#818CF8"/>
            </svg>
          </div>
          <div>
           
            <p className="text-xs text-slate-600 mt-0.5">HR Platform</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest px-3 mb-3">Navigation</p>
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}>
            <span className="text-base w-5 text-center opacity-80">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && alertCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">
                {alertCount}
              </span>
            )}
            {item.candidateBadge && candidateCount > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">
                {candidateCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User row */}
      <div className="p-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl group hover:bg-white/[0.03] transition-colors">
          <Avatar initials={user?.avatar || 'HR'} size="sm" index={0} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-300 truncate leading-none">{user?.name || 'HR Manager'}</p>
            <p className="text-xs text-slate-600 mt-0.5">HR Manager</p>
          </div>
          {/* Sign-out button — opens confirm modal */}
          <button
            onClick={onSignOutClick}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────
export default function HRLayout() {
  const { user, logout }  = useAuth()
  const navigate           = useNavigate()
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [signOutOpen, setSignOutOpen]     = useState(false)
  const [signingOut, setSigningOut]       = useState(false)

  // Listen for modal-open events dispatched by any child page
  // so polling can be paused while a form is open.
  const [modalOpen, setModalOpen] = useState(false)
  useEffect(() => {
    const handler = (e) => setModalOpen(e.detail?.open ?? false)
    window.addEventListener('hr:modal', handler)
    return () => window.removeEventListener('hr:modal', handler)
  }, [])

  // Live sync — paused when any modal is open to prevent mid-form re-renders
  useRealtimeSync({ pausePolling: modalOpen || signOutOpen })

  const { data: alerts = [] }             = useAlerts()
  const { data: candidates = [] } = useCandidates()
  const alertCount = alerts.length
  const candidateCount = candidates.length

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
        w-60 flex-shrink-0 bg-[#0A0E1A] border-r border-white/[0.05]
        transform transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <SidebarContent
          user={user}
          alertCount={alertCount}
          candidateCount={candidateCount}
          onSignOutClick={() => setSignOutOpen(true)}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#0A0E1A] border-b border-white/[0.05] flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="font-display font-bold text-white text-sm">D Company</span>
          {alertCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-bold">
              {alertCount}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Sign-out confirmation modal */}
      {signOutOpen && (
        <SignOutModal
          user={user}
          loading={signingOut}
          onConfirm={handleSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}
    </div>
  )
}