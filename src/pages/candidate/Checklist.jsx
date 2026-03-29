import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  useChecklist,
  useMarkOnboardingComplete,
  useCompleteChecklistByTitle,
} from '../../hooks/useData'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

const CATEGORY_META = {
  legal:     { label: 'Legal',     icon: '⚖️', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  documents: { label: 'Documents', icon: '📄', color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
  it:        { label: 'IT Setup',  icon: '💻', color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20' },
  hr:        { label: 'HR',        icon: '🏢', color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  training:  { label: 'Training',  icon: '📚', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  social:    { label: 'Social',    icon: '🤝', color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20' },
  wellbeing: { label: 'Wellbeing', icon: '💚', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
}

// Items auto-completed by system — candidates cannot tick them manually
const SYSTEM_ITEMS = new Set([
  'Profile Completed',
  'Contract Signed',
  'Documents Submitted',
  'Documents Verified',
  'Company Email Created',
  'System Access Granted',
  'ID Card Issued',
])

// Items the candidate must complete before Final Submit is unlocked
const SUBMIT_REQUIRED = [
  'Profile Completed',
  'Contract Signed',
  'Documents Submitted',
  'Documents Verified',
  'Policy Training',
]

// ── Policy Training Modal ─────────────────────────────────────
function PolicyTrainingModal({ isCompleted, onClose, onMarkDone }) {
  const [confirming, setConfirming] = useState(false)

  const handleDone = async () => {
    setConfirming(true)
    try { await onMarkDone() } finally { setConfirming(false) }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.2s ease-out both' }}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Policy Training</h2>
            <p className="text-slate-500 text-xs mt-0.5">Watch the video, then confirm you have understood</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all text-lg">
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="relative w-full rounded-xl overflow-hidden bg-black border border-white/[0.06]"
            style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
              title="Company Policy Training"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { icon: '⚖️', label: 'Code of conduct' },
              { icon: '🔒', label: 'Data & security policy' },
              { icon: '🤝', label: 'Workplace behaviour' },
              { icon: '📋', label: 'Leave & attendance' },
            ].map(t => (
              <div key={t.label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <span className="text-sm">{t.icon}</span>
                <span className="text-xs text-slate-400">{t.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all">
              Watch later
            </button>
            {isCompleted ? (
              <div className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2">
                ✓ Already completed
              </div>
            ) : (
              <button onClick={handleDone} disabled={confirming}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {confirming
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : '✓ I have watched and understood'}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function Checklist() {
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const { data: items = [], isLoading } = useChecklist(user?.candidate_id)
  const markComplete    = useMarkOnboardingComplete()
  const completeByTitle = useCompleteChecklistByTitle()
  const markedRef       = useRef(false)

  const [policyModalOpen, setPolicyModalOpen] = useState(false)

  const completed  = items.filter(i => i.completed).length
  const pct        = items.length > 0 ? Math.round((completed / items.length) * 100) : 0
  const policyItem = items.find(i => i.title === 'Policy Training')
  const policyDone = policyItem?.completed ?? false

  // ID Card Issued = final submit already done (set server-side)
  const idCardItem      = items.find(i => i.title === 'ID Card Issued')
  const alreadySubmitted = idCardItem?.completed ?? false

  // Whether all SUBMIT_REQUIRED items are done → show "Ready to Submit" CTA
  const canSubmit = SUBMIT_REQUIRED.every(
    title => items.find(i => i.title === title)?.completed
  )

  // Auto-mark onboarding complete at 100%
  useEffect(() => {
    if (pct === 100 && !markedRef.current && user?.candidate_id) {
      markedRef.current = true
      markComplete.mutate(user.candidate_id)
    }
  }, [pct, user?.candidate_id])

  const handleItemClick = (item) => {
    if (item.title === 'Policy Training') setPolicyModalOpen(true)
  }

  const handlePolicyMarkDone = () =>
    new Promise((resolve) => {
      completeByTitle.mutate(
        {
          candidateId: user.candidate_id,
          title: 'Policy Training',
          description: 'Mandatory compliance and policy training',
          category: 'training',
          sort_order: 7,
        },
        {
          onSuccess: () => { toast.success('Policy training completed! 🎓'); resolve() },
          onError:   () => resolve(),
        }
      )
    })

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading checklist…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Page header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Onboarding Checklist</h1>
        <p className="text-slate-500 text-sm mt-1">
          Complete all steps to unlock your <strong className="text-teal-400">Final Submit</strong>
        </p>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-5 sm:p-6 mb-6 animate-slide-up opacity-0"
        style={{
          animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)',
        }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-300">Overall Progress</p>
            <p className="text-xs text-slate-500 mt-0.5">{completed} of {items.length} tasks completed</p>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-white">
            {pct}<span className="text-slate-500 text-lg sm:text-xl font-normal">%</span>
          </p>
        </div>
        <ProgressBar value={pct} showLabel={false} size="lg" />

        {/* ── Ready to submit — redirect to OnboardingReview ── */}
        {canSubmit && !alreadySubmitted && (
          <div className="mt-5 rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />
            <div className="p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-center sm:text-left">
                <p className="font-display font-bold text-white text-base">Ready to Submit! 🎉</p>
                <p className="text-slate-400 text-xs mt-1">
                  Review your profile, contract and documents, then click Final Submit.
                </p>
              </div>
              <button
                onClick={() => navigate('/onboarding/review')}
                className="flex-shrink-0 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-all whitespace-nowrap"
                style={{ boxShadow: '0 0 20px rgba(20,184,166,0.4)' }}>
                Review & Submit →
              </button>
            </div>
          </div>
        )}

        {/* ── Already submitted — waiting for IT ────────────── */}
        {alreadySubmitted && pct < 100 && (
          <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">⏳</span>
            <div>
              <p className="text-sm font-semibold text-indigo-300">Onboarding Submitted</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Your ID card has been emailed to you. Waiting for IT to complete system access provisioning.
              </p>
            </div>
          </div>
        )}

        {/* ── 100% complete ─────────────────────────────────── */}
        {pct === 100 && (
          <div className="mt-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />
            <div className="p-5 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-display font-bold text-white text-lg">Onboarding Complete!</p>
              <p className="text-slate-400 text-sm mt-1">
                Every step is done. HR has been notified and will be in touch shortly.
              </p>
              <button
                onClick={() => navigate('/onboarding/review')}
                className="mt-4 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-all inline-flex items-center gap-2">
                View My Summary →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5 px-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <span className="text-emerald-400" style={{ fontSize: 7 }}>✓</span>
          </div>
          Auto-completed by system
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
          Requires your action
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📋</p>
          <p>No checklist items assigned yet</p>
        </div>
      )}

      {/* Grouped items */}
      <div className="space-y-5 sm:space-y-6">
        {Object.entries(grouped).map(([cat, catItems], gi) => {
          const meta    = CATEGORY_META[cat] || CATEGORY_META.hr
          const catDone = catItems.filter(i => i.completed).length
          return (
            <div key={cat} className="animate-slide-up opacity-0"
              style={{ animationDelay: `${gi * 80}ms`, animationFillMode: 'forwards' }}>

              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className="text-xs text-slate-600">{catDone}/{catItems.length}</span>
              </div>

              <div className="space-y-2">
                {catItems.map(item => {
                  const isPolicy    = item.title === 'Policy Training'
                  const isClickable = isPolicy && !item.completed
                  const isSystem    = SYSTEM_ITEMS.has(item.title)

                  return (
                    <div
                      key={item.id}
                      onClick={() => isClickable ? handleItemClick(item) : undefined}
                      className={[
                        'flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all duration-200 group',
                        isClickable
                          ? 'cursor-pointer bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.07]'
                          : item.completed
                            ? 'cursor-default bg-white/[0.01] border-white/[0.03] opacity-60'
                            : 'cursor-default bg-[#0C1A1D] border-white/[0.05]',
                      ].join(' ')}>

                      {/* Circle */}
                      <div className={[
                        'w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all',
                        item.completed
                          ? 'bg-emerald-500/20 border-emerald-500/40'
                          : isClickable
                            ? 'bg-amber-500/10 border-amber-500/30 group-hover:border-amber-500/60'
                            : 'bg-white/[0.03] border-white/10',
                      ].join(' ')}>
                        {item.completed && <span className="text-emerald-400 text-[10px] font-bold">✓</span>}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className={[
                            'text-sm font-semibold transition-colors',
                            item.completed ? 'line-through text-slate-500' : 'text-slate-200',
                          ].join(' ')}>
                            {item.title}
                          </p>
                          {isSystem && !item.completed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500 border border-white/[0.05] uppercase tracking-wider">
                              auto
                            </span>
                          )}
                          {isClickable && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                              action needed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                        {item.completed_at && (
                          <p className="text-[10px] text-teal-700 mt-1">
                            ✓ Completed {new Date(item.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {isClickable && (
                        <span className="hidden sm:block text-xs text-amber-400/60 group-hover:text-amber-400 transition-colors font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                          Watch video →
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {policyModalOpen && (
        <PolicyTrainingModal
          isCompleted={policyDone}
          onClose={() => setPolicyModalOpen(false)}
          onMarkDone={handlePolicyMarkDone}
        />
      )}
    </div>
  )
}