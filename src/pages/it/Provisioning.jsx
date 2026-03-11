import { useState } from 'react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useProvisioningRequests, useUpdateProvisioning } from '../../hooks/useData'
import toast from 'react-hot-toast'

// Systems that need to be provisioned for each new hire
const SYSTEMS = [
  { key: 'email',    label: 'Work Email',     icon: '📧', desc: 'G Suite / Outlook account' },
  { key: 'slack',    label: 'Slack',          icon: '💬', desc: 'Workspace + channels' },
  { key: 'laptop',   label: 'Laptop Setup',   icon: '💻', desc: 'Device config + MDM enroll' },
  { key: 'vpn',      label: 'VPN Access',     icon: '🔒', desc: 'Remote access credentials' },
  { key: 'jira',     label: 'Jira / Notion',  icon: '📋', desc: 'Project management tools' },
  { key: 'hr_system',label: 'HR System',      icon: '🏢', desc: 'BambooHR / Workday login' },
]

const STATUS_STYLES = {
  pending:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled:   'bg-red-500/10 text-red-400 border-red-500/20',
}
const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }

function RequestCard({ req, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [systems, setSystems]   = useState(req.systems_provisioned || {})

  const toggleSystem = (key) => {
    const next = { ...systems, [key]: !systems[key] }
    setSystems(next)
    onUpdate(req.id, { systems_provisioned: next })
  }

  const allDone    = SYSTEMS.every(s => systems[s.key])
  const doneCt     = SYSTEMS.filter(s => systems[s.key]).length
  const isPending  = req.status === 'pending'
  const isInProg   = req.status === 'in_progress'
  const isDone     = req.status === 'completed'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200
      ${isDone
        ? 'border-emerald-500/15 bg-emerald-500/[0.02]'
        : isPending
          ? 'border-amber-500/15 bg-amber-500/[0.02]'
          : 'border-blue-500/15 bg-blue-500/[0.02]'}`}>

      {/* Header row */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 flex-shrink-0">
            {(req.candidate_name || '?').slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <p className="font-semibold text-slate-200 text-sm">{req.candidate_name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${STATUS_STYLES[req.status] || STATUS_STYLES.pending}`}>
                {STATUS_LABEL[req.status]}
              </span>
            </div>
            <p className="text-xs text-slate-500">{req.position} · {req.department}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
              <span>📧 {req.work_email}</span>
              <span>🗓️ Starting {req.start_date}</span>
              {req.manager && <span>👤 {req.manager}</span>}
              {req.location && <span>📍 {req.location}</span>}
            </div>
          </div>

          {/* Progress ring */}
          <div className="text-center flex-shrink-0">
            <div className={`text-xl font-display font-bold ${allDone ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-blue-400'}`}>
              {doneCt}/{SYSTEMS.length}
            </div>
            <p className="text-[10px] text-slate-600">systems</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 mb-0">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">Provisioning progress</span>
            <span className="text-slate-400 font-semibold">{Math.round((doneCt / SYSTEMS.length) * 100)}%</span>
          </div>
          <div className="w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700
              ${allDone ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${(doneCt / SYSTEMS.length) * 100}%` }} />
          </div>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
          {expanded ? '▲ Hide systems' : '▼ Manage systems'}
        </button>
      </div>

      {/* Systems checklist */}
      {expanded && (
        <div className="border-t border-white/[0.05] p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {SYSTEMS.map(sys => (
              <button key={sys.key} onClick={() => toggleSystem(sys.key)} disabled={isDone}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all disabled:cursor-not-allowed
                  ${systems[sys.key]
                    ? 'bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0 transition-all
                  ${systems[sys.key]
                    ? 'bg-emerald-500/30 border-emerald-500/50'
                    : 'bg-white/[0.03] border-white/10'}`}>
                  {systems[sys.key] && <span className="text-emerald-400 text-[10px] font-bold">✓</span>}
                </div>
                <span className="text-base">{sys.icon}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${systems[sys.key] ? 'text-emerald-300 line-through opacity-70' : 'text-slate-300'}`}>
                    {sys.label}
                  </p>
                  <p className="text-[10px] text-slate-600 truncate">{sys.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {!isDone && (
            <div className="flex flex-wrap gap-2">
              {isPending && (
                <button onClick={() => onUpdate(req.id, { status: 'in_progress' })}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all">
                  🚀 Start Provisioning
                </button>
              )}
              {(isPending || isInProg) && allDone && (
                <button onClick={() => onUpdate(req.id, { status: 'completed' })}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all">
                  ✅ Mark as Completed
                </button>
              )}
              {isInProg && !allDone && (
                <button onClick={() => onUpdate(req.id, { status: 'completed' })}
                  className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 text-xs font-semibold rounded-xl border border-white/[0.08] transition-all">
                  Mark Done Anyway
                </button>
              )}
              <button onClick={() => {
                  const notes = prompt('Add a note or comment (optional):')
                  onUpdate(req.id, { notes: notes || '' })
                  toast.success('Note saved')
                }}
                className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 text-xs font-semibold rounded-xl border border-white/[0.06] transition-all">
                📝 Add Note
              </button>
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span>✅</span> All systems provisioned. Candidate has full access.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Provisioning({ showCompleted = false }) {
  const { data: allRequests = [], isLoading } = useProvisioningRequests()
  const updateMutation = useUpdateProvisioning()

  const requests = showCompleted
    ? allRequests.filter(r => r.status === 'completed')
    : allRequests.filter(r => r.status !== 'completed')

  const pending   = allRequests.filter(r => r.status === 'pending').length
  const inProg    = allRequests.filter(r => r.status === 'in_progress').length
  const completed = allRequests.filter(r => r.status === 'completed').length

  const handleUpdate = (id, patch) => {
    updateMutation.mutate({ id, ...patch }, {
      onSuccess: () => {
        if (patch.status === 'completed') toast.success('Provisioning completed! 🎉')
        else if (patch.status === 'in_progress') toast.success('Request started')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading provisioning requests…" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-7 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-white">
          {showCompleted ? 'Completed Provisioning' : 'IT Provisioning Requests'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {showCompleted
            ? `${completed} candidates fully provisioned`
            : 'Set up system access for incoming candidates'}
        </p>
      </div>

      {/* Stats */}
      {!showCompleted && (
        <div className="grid grid-cols-3 gap-3 mb-7">
          {[
            { label: 'Pending',     count: pending,   color: 'text-amber-400',   bg: 'bg-amber-500/5 border-amber-500/15' },
            { label: 'In Progress', count: inProg,    color: 'text-blue-400',    bg: 'bg-blue-500/5 border-blue-500/15' },
            { label: 'Completed',   count: completed, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 text-center ${bg}`}>
              <p className={`text-2xl font-display font-bold ${color}`}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-4xl mb-3">{showCompleted ? '✅' : '🎉'}</p>
          <p className="font-medium text-slate-300">
            {showCompleted ? 'No completed requests yet' : 'No pending provisioning requests'}
          </p>
          {!showCompleted && <p className="text-sm mt-1">New requests appear here when HR adds a candidate</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req, i) => (
            <div key={req.id} className="animate-slide-up opacity-0"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}>
              <RequestCard req={req} onUpdate={handleUpdate} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}