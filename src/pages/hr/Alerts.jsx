import StatusBadge from '../../components/shared/StatusBadge'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useAlerts, useResolveAlert } from '../../hooks/useData'
import toast from 'react-hot-toast'

const TYPE_ICON  = { expiry: '📅', stalled: '🐌', verification_failed: '❌', missing: '📭' }
const TYPE_LABEL = { expiry: 'Document Expiry', stalled: 'Onboarding Stalled', verification_failed: 'Verification Failed', missing: 'Missing Document' }

export default function Alerts() {
  const { data: alerts = [], isLoading } = useAlerts()
  const resolveMutation = useResolveAlert()

  const high   = alerts.filter(a => a.severity === 'high')
  const medium = alerts.filter(a => a.severity === 'medium')
  const low    = alerts.filter(a => a.severity === 'low')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading alerts…" />
      </div>
    )
  }

  const AlertCard = ({ alert, delay }) => (
    <div className="rounded-2xl border p-4 sm:p-5 animate-slide-up opacity-0"
      style={{
        animationDelay: `${delay}ms`, animationFillMode: 'forwards',
        borderColor:     alert.severity === 'high' ? 'rgba(239,68,68,0.15)' : alert.severity === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(20,184,166,0.15)',
        backgroundColor: alert.severity === 'high' ? 'rgba(239,68,68,0.03)' : alert.severity === 'medium' ? 'rgba(245,158,11,0.02)' : 'rgba(20,184,166,0.02)',
      }}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg flex-shrink-0
            ${alert.severity === 'high'   ? 'bg-red-500/10 border border-red-500/20'
            : alert.severity === 'medium' ? 'bg-amber-500/10 border border-amber-500/20'
            :                               'bg-teal-500/10 border border-teal-500/20'}`}>
            {TYPE_ICON[alert.type] || '⚠️'}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">{TYPE_LABEL[alert.type]}</p>
            <p className="font-semibold text-slate-200 text-sm mt-0.5 truncate">{alert.person_name}</p>
          </div>
        </div>
        <StatusBadge status={alert.severity} />
      </div>

      <p className="text-sm text-slate-400 mb-4 pl-12 sm:pl-[52px]">{alert.message}</p>

      <div className="flex flex-wrap gap-2 pl-12 sm:pl-[52px]">
        {alert.type === 'expiry' && <>
          <button onClick={() => toast.success(`Reminder sent to ${alert.person_name}`)}
            className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-lg text-xs font-semibold hover:bg-teal-500/20 transition-colors">
            Send Reminder
          </button>
          <button onClick={() => toast.success(`Escalated for ${alert.person_name}`)}
            className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-slate-400 rounded-lg text-xs font-semibold hover:bg-white/[0.06] transition-colors">
            Escalate
          </button>
        </>}
        {alert.type === 'stalled' && (
          <button onClick={() => toast.success(`Nudge sent to ${alert.person_name}`)}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-colors">
            Send Nudge
          </button>
        )}
        {alert.type === 'verification_failed' && (
          <button onClick={() => toast.success(`Re-upload request sent to ${alert.person_name}`)}
            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors">
            Request Re-upload
          </button>
        )}
        <button onClick={() => resolveMutation.mutate(alert.id)}
          disabled={resolveMutation.isPending}
          className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-slate-400 rounded-lg text-xs font-semibold hover:bg-white/[0.06] transition-colors disabled:opacity-40">
          Dismiss
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Alerts</h1>
        <p className="text-slate-500 text-sm mt-1">
          {alerts.length > 0 ? `${alerts.length} alerts need attention` : 'All clear — no active alerts'}
        </p>
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-semibold text-slate-300">No active alerts</p>
          <p className="text-sm mt-1">All documents and onboarding are on track</p>
        </div>
      )}

      {high.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">🔴 High Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {high.map((a, i) => <AlertCard key={a.id} alert={a} delay={i * 80} />)}
          </div>
        </div>
      )}
      {medium.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">🟡 Medium Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {medium.map((a, i) => <AlertCard key={a.id} alert={a} delay={i * 80 + 200} />)}
          </div>
        </div>
      )}
      {low.length > 0 && (
        <div>
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3">🟢 Low Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {low.map((a, i) => <AlertCard key={a.id} alert={a} delay={i * 80 + 400} />)}
          </div>
        </div>
      )}
    </div>
  )
}