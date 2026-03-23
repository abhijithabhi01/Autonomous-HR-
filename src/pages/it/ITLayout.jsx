import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProvisioningRequests, useCleanupChecklistTitles } from '../../hooks/useData'

const NAV = [
  { to: '/it',              label: 'Provisioning', icon: '🖥️', exact: true },
  { to: '/it/completed',    label: 'Completed',    icon: '✅' },
]

function SignOutModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl"
        style={{ animation: 'slideUp 0.2s ease-out both' }}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-white text-lg mb-1">Sign out?</h2>
          <p className="text-slate-400 text-sm">Signed in as <span className="text-white font-semibold">{user?.name || 'IT Admin'}</span></p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all disabled:opacity-50">
            Stay signed in
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign out'}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

export default function ITLayout() {
  const { user, logout }  = useAuth()
  const navigate          = useNavigate()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut]   = useState(false)
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const { data: requests = [] } = useProvisioningRequests()
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const cleanup = useCleanupChecklistTitles()

  // On first mount, purge stale Team Introduction + Day 7 items from all existing candidates
  useEffect(() => {
    cleanup.mutate(['Team Introduction', 'Day 7 Check-in', 'Wellbeing Check-in'])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    setSigningOut(true)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#070B15] overflow-hidden">
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-60 flex-shrink-0 flex flex-col
        bg-[#0A0E1A] border-r border-white/[0.05]
        transform transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 0 16px rgba(34,211,238,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="#22D3EE" strokeWidth="1.8"/>
                <path d="M8 21h8M12 17v4" stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="font-display font-bold text-white text-base leading-none">PeopleOS</p>
              <p className="text-xs text-slate-600 mt-0.5">IT Admin Portal</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-200 p-1.5 rounded-lg transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Pending badge */}
        {pendingCount > 0 && (
          <div className="mx-3 my-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <p className="text-xs font-bold text-amber-300">{pendingCount} Pending</p>
              <p className="text-[10px] text-slate-500">provisioning requests</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest px-3 mb-3">IT Admin</p>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact} onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}>
              <span className="w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.to === '/it' && pendingCount > 0 && (
                <span className="bg-amber-500 text-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User row */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl group hover:bg-white/[0.03] transition-colors">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-300 flex-shrink-0">
              {(user?.name || 'IT').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-300 truncate leading-none">{user?.name || 'IT Admin'}</p>
              <p className="text-xs text-slate-600 mt-0.5">IT Administrator</p>
            </div>
            <button onClick={() => setSignOutOpen(true)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Sign out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#0A0E1A] border-b border-white/[0.05] flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="font-display font-bold text-white text-sm">IT Admin</span>
          {pendingCount > 0 && (
            <span className="ml-auto bg-amber-500 text-black text-[10px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          )}
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>

      {signOutOpen && (
        <SignOutModal user={user} loading={signingOut} onConfirm={handleSignOut} onCancel={() => setSignOutOpen(false)} />
      )}
    </div>
  )
}