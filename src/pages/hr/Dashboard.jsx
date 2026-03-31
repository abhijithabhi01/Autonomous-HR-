import { useNavigate } from 'react-router-dom'
import StatCard from '../../components/shared/StatCard'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidates, useAlerts, useExpiryAlerts, useDeadlineAlerts } from '../../hooks/useData'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: candidates = [], isLoading: candLoading } = useCandidates()
  const { data: backendAlerts = [], isLoading: alertLoading } = useAlerts()
  const { data: expiryAlerts = [] } = useExpiryAlerts()
  const { data: deadlineAlerts = [] } = useDeadlineAlerts()
  const alerts = [...backendAlerts, ...expiryAlerts, ...deadlineAlerts]
  
  if (candLoading) {
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
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white"> HR Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Candidates" value={candidates.length} icon="🧑‍💼" color="amber" delay={0} sub="In pipeline" />
        <StatCard label="Alerts" value={alerts.length} icon="⚠️" color="red" delay={80} sub="Need attention" />
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

        {/* Alerts panel */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] overflow-hidden animate-slide-up opacity-0"
          style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <div className="px-4 sm:px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-white text-sm">Alerts</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                {alerts.length > 0 ? `${alerts.length} need attention` : 'All clear'}
              </p>
            </div>
            <button onClick={() => navigate('/hr/alerts')}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
              See all →
            </button>
          </div>

          {alertLoading
            ? <div className="py-8 flex justify-center"><LoadingSpinner size="sm" /></div>
            : alerts.length === 0
              ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">🎉</p>
                  <p className="text-slate-500 text-sm">No active alerts</p>
                  <p className="text-xs text-slate-600 mt-1">All documents and onboarding on track</p>
                </div>
              )
              : (
                <div className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
                  {alerts.map(a => (
                    <div key={a.id} className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === 'high' ? 'bg-red-400' : a.severity === 'medium' ? 'bg-amber-400' : 'bg-teal-400'
                          }`} />
                        <p className="text-xs font-semibold text-slate-300 truncate">{a.candidate_name}</p>
                        <StatusBadge status={a.severity} />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 pl-3.5">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>
    </div>
  )
}