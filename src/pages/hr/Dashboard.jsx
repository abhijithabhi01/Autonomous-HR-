import { useNavigate } from 'react-router-dom'
import StatCard from '../../components/shared/StatCard'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidates, useEmployees, useAlerts } from '../../hooks/useData'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: candidates = [], isLoading: candLoading } = useCandidates()
  const { data: employees = [], isLoading: empLoading  } = useEmployees()
  const { data: alerts = [],  isLoading: alertLoading } = useAlerts()

  // candidates and employees now from separate tables
  const activeEmp  = employees
  const onboarding = candidates.filter(c => c.onboarding_status === 'onboarding')
  const preJoining = candidates.filter(c => c.onboarding_status === 'pre_joining')

  if (candLoading || empLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading dashboard…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Candidates" value={candidates.length} icon="🧑‍💼" color="amber"   delay={0}   sub="In pipeline" />
        <StatCard label="Onboarding" value={onboarding.length} icon="🚀"   color="teal"    delay={80}  sub="In progress" />
        <StatCard label="Employees"  value={activeEmp.length}  icon="✅"   color="emerald" delay={160} sub="Active" />
        <StatCard label="Alerts"     value={alerts.length}     icon="⚠️"   color="red"     delay={240} sub="Need attention" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Onboarding pipeline — candidates only */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.05] bg-[#0C1A1D] overflow-hidden animate-slide-up opacity-0"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.05]">
            <div>
              <h2 className="font-display font-semibold text-white text-sm sm:text-base">Onboarding Pipeline</h2>
              <p className="text-slate-500 text-xs mt-0.5">{candidates.length} candidates in progress</p>
            </div>
            <button onClick={() => navigate('/hr/candidates')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors whitespace-nowrap">
              View all →
            </button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {candidates.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🎯</p>
                <p className="text-slate-500 text-sm">No candidates in pipeline</p>
                <button onClick={() => navigate('/hr/candidates')}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  + Add candidate →
                </button>
              </div>
            ) : (
              candidates.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/hr/candidates/${p.id}`)}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-indigo-500/[0.02] transition-colors cursor-pointer">
                  <Avatar initials={p.avatar} size="sm" index={i} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-200 truncate">{p.full_name}</p>
                      <StatusBadge status={p.onboarding_status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{p.position} · {p.department}</p>
                  </div>
                  <div className="w-20 sm:w-28 flex-shrink-0">
                    <ProgressBar value={p.onboarding_progress} size="sm" showLabel={false} />
                    <p className="text-xs text-slate-500 mt-1 text-right">{p.onboarding_progress}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-5">

          {/* Alerts */}
          <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.025] overflow-hidden animate-slide-up opacity-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
            <div className="px-4 sm:px-5 py-4 border-b border-red-500/10 flex items-center justify-between">
              <h2 className="font-display font-semibold text-white text-sm">Top Alerts</h2>
              <button onClick={() => navigate('/hr/alerts')} className="text-xs text-red-400 hover:text-red-300 transition-colors">See all →</button>
            </div>
            {alertLoading
              ? <div className="py-6 flex justify-center"><LoadingSpinner size="sm" /></div>
              : alerts.length === 0
                ? <div className="px-5 py-6 text-center text-slate-500 text-sm">No active alerts 🎉</div>
                : alerts.slice(0, 3).map(a => (
                  <div key={a.id} className="px-4 sm:px-5 py-3 border-b border-red-500/[0.06] last:border-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <StatusBadge status={a.severity} />
                      <p className="text-xs font-medium text-slate-300 truncate">{a.person_name}</p>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{a.message}</p>
                  </div>
                ))}
          </div>

          {/* Pipeline breakdown */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-4 sm:p-5 animate-slide-up opacity-0"
            style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
            <h2 className="font-display font-semibold text-white text-sm mb-4">Pipeline Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Pre-Joining Candidates', count: preJoining.length, color: 'bg-amber-400',   route: '/hr/candidates' },
                { label: 'Onboarding Candidates',  count: onboarding.length, color: 'bg-indigo-400',  route: '/hr/candidates' },
                { label: 'Active Employees',        count: activeEmp.length,  color: 'bg-emerald-400', route: '/hr/employees' },
              ].map(({ label, count, color, route }) => (
                <button key={label} onClick={() => navigate(route)}
                  className="w-full flex items-center justify-between hover:bg-white/[0.02] rounded-lg px-1 py-0.5 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-200">{count}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <button onClick={() => navigate('/it')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15 hover:bg-indigo-500/10 transition-colors group">
                <div className="flex items-center gap-2">
                  <span>🖥️</span>
                  <span className="text-xs font-semibold text-indigo-300">IT Provisioning</span>
                </div>
                <span className="text-xs text-slate-600 group-hover:text-indigo-400 transition-colors">Open →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}