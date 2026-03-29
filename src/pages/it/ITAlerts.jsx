// src/pages/it/ITAlerts.jsx
// IT portal alerts page.
// Shows candidates who have completed onboarding (100%) but whose provisioning
// is not yet finished — laptop, work email, and full system access still needed.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useITReadyAlerts, useUpdateProvisioning } from '../../hooks/useData'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// Which systems map to each "request" type shown in the alert card
const SYSTEM_GROUPS = [
  {
    key:      'laptop',
    label:    'Laptop Setup',
    icon:     '💻',
    desc:     'Device configuration & MDM enrolment',
    color:    'cyan',
    systemKey: 'laptop',
  },
  {
    key:      'email',
    label:    'Work Email',
    icon:     '📧',
    desc:     'G Suite / Outlook company account',
    color:    'indigo',
    systemKey: 'email',
  },
  {
    key:      'access',
    label:    'Full System Access',
    icon:     '🔑',
    desc:     'Slack · VPN · Jira · HR system',
    color:    'emerald',
    // "done" when all non-email/laptop systems are provisioned
    systemKeys: ['slack', 'vpn', 'jira', 'hr_system'],
  },
]

const COLOR = {
  cyan:    { ring: 'border-cyan-500/20',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400'    },
  indigo:  { ring: 'border-indigo-500/20',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  dot: 'bg-indigo-400'  },
  emerald: { ring: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
}

function systemDone(group, systems) {
  if (group.systemKey)  return !!systems[group.systemKey]
  return group.systemKeys.every(k => !!systems[k])
}

// ── Individual alert card ─────────────────────────────────────
function ITAlertCard({ alert, onGoToProvisioning, delay = 0 }) {
  const updateMutation = useUpdateProvisioning()
  const [localSystems, setLocalSystems] = useState(alert.systems_provisioned || {})

  const pendingGroups  = SYSTEM_GROUPS.filter(g => !systemDone(g, localSystems))
  const completedCount = SYSTEM_GROUPS.filter(g =>  systemDone(g, localSystems)).length
  const allDone        = pendingGroups.length === 0

  const handleQuickMark = async (group) => {
    if (!alert.provisioning_id) {
      toast.error('No provisioning request found — go to Provisioning tab to manage.')
      return
    }

    // Build the new systems_provisioned patch
    const next = { ...localSystems }
    if (group.systemKey) {
      next[group.systemKey] = true
    } else {
      group.systemKeys.forEach(k => { next[k] = true })
    }

    setLocalSystems(next)   // optimistic update

    // Check if all 6 systems are now done
    const allSystems = ['email', 'slack', 'laptop', 'vpn', 'jira', 'hr_system']
    const nowAllDone = allSystems.every(k => next[k])
    const patch = {
      id: alert.provisioning_id,
      systems_provisioned: next,
      ...(nowAllDone ? { status: 'completed' } : {}),
    }

    updateMutation.mutate(patch, {
      onSuccess: () => {
        toast.success(
          nowAllDone
            ? `✅ ${alert.candidate_name} fully provisioned!`
            : `✔ ${group.label} marked done for ${alert.candidate_name}`
        )
      },
      onError: (err) => {
        setLocalSystems(alert.systems_provisioned || {})  // roll back
        toast.error(err.message)
      },
    })
  }

  return (
    <div
      className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden
                 animate-slide-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {/* Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20
                          flex items-center justify-center text-sm font-bold text-amber-300 flex-shrink-0">
            {(alert.candidate_name || '?').slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <p className="font-semibold text-slate-200 text-sm">{alert.candidate_name}</p>
              {allDone ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide
                                 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  All Provisioned ✅
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide
                                 bg-amber-500/10 text-amber-400 border-amber-500/20">
                  Awaiting IT Setup
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{alert.position} · {alert.department}</p>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
              <span className="text-emerald-400 font-semibold">✅ Onboarding 100% complete</span>
              {alert.work_email && <span>📧 {alert.work_email}</span>}
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>IT provisioning</span>
                <span className={`font-bold ${allDone ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {completedCount} / {SYSTEM_GROUPS.length}
                </span>
              </div>
              <div className="w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${(completedCount / SYSTEM_GROUPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System action tiles */}
      {!allDone && (
        <div className="border-t border-white/[0.05] p-4 sm:p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            Pending Actions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {SYSTEM_GROUPS.map(group => {
              const done = systemDone(group, localSystems)
              const c    = COLOR[group.color]
              return (
                <button
                  key={group.key}
                  onClick={() => !done && handleQuickMark(group)}
                  disabled={done || updateMutation.isPending}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                    ${done
                      ? `${c.bg} ${c.ring} opacity-60 cursor-not-allowed`
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-amber-500/30 hover:bg-amber-500/[0.04] cursor-pointer'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0
                    ${done ? `${c.bg} ${c.ring}` : 'bg-white/[0.03] border-white/10'}`}>
                    {done
                      ? <span className={`${c.text} text-[10px] font-bold`}>✓</span>
                      : <span className="w-2 h-2 rounded-full bg-amber-500/60" />}
                  </div>
                  <span className="text-xl flex-shrink-0">{group.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${done ? `${c.text} line-through opacity-70` : 'text-slate-300'}`}>
                      {group.label}
                    </p>
                    <p className="text-[10px] text-slate-600 truncate">{group.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onGoToProvisioning(alert.candidate_id)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold
                         rounded-xl transition-all flex items-center gap-1.5"
              style={{ boxShadow: '0 0 12px rgba(34,211,238,0.2)' }}
            >
              🖥️ Open Provisioning
            </button>
          </div>
        </div>
      )}

      {allDone && (
        <div className="border-t border-white/[0.05] px-5 py-3">
          <p className="text-xs text-emerald-400 flex items-center gap-2">
            <span>✅</span> All systems provisioned — candidate has full access.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function ITAlerts() {
  const { data: alerts = [], isLoading } = useITReadyAlerts()
  const navigate = useNavigate()

  const pending  = alerts.filter(a => a.provisioning_status !== 'completed' && a.missing_items.length > 0)
  const allDone  = alerts.filter(a => a.missing_items.length === 0 || a.provisioning_status === 'completed')

  const goToProvisioning = (candidateId) => {
    // Navigate to the provisioning tab; the card will be visible there
    navigate('/it')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Checking provisioning status…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* Page header */}
      <div className="mb-7 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">IT Alerts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Candidates who have completed onboarding and are waiting for IT setup
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-7">
        {[
          { label: 'Awaiting Setup', count: pending.length,  color: 'text-amber-400',   bg: 'bg-amber-500/5   border-amber-500/15' },
          { label: 'Fully Done',     count: allDone.length,  color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 text-center ${bg}`}>
            <p className={`text-2xl font-display font-bold ${color}`}>{count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      {pending.length > 0 && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl
                        bg-amber-500/[0.06] border border-amber-500/15 animate-fade-in">
          <span className="text-xl flex-shrink-0 mt-0.5">⚡</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {pending.length} candidate{pending.length !== 1 ? 's' : ''} ready for IT provisioning
            </p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              These candidates have finished their onboarding. Set up their laptop, work email,
              and system access to complete the process. Tick items directly here or open the Provisioning tab for full controls.
            </p>
          </div>
        </div>
      )}

      {/* Pending alerts */}
      {pending.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
            🔔 Awaiting IT Setup ({pending.length})
          </p>
          <div className="space-y-4">
            {pending.map((alert, i) => (
              <ITAlertCard
                key={alert.id}
                alert={alert}
                onGoToProvisioning={goToProvisioning}
                delay={i * 70}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed (all provisioned) */}
      {allDone.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">
            ✅ Fully Provisioned ({allDone.length})
          </p>
          <div className="space-y-3">
            {allDone.map((alert, i) => (
              <div
                key={alert.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl
                           bg-emerald-500/[0.04] border border-emerald-500/15
                           animate-slide-up opacity-0"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                                flex items-center justify-center text-xs font-bold text-emerald-300 flex-shrink-0">
                  {(alert.candidate_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-300">{alert.candidate_name}</p>
                  <p className="text-xs text-slate-500">{alert.position} · {alert.department}</p>
                </div>
                <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">✅ Done</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="text-center py-24 text-slate-500">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-semibold text-slate-300">No provisioning alerts</p>
          <p className="text-sm mt-1">
            Alerts appear here when a candidate reaches 100% onboarding completion
          </p>
        </div>
      )}
    </div>
  )
}
