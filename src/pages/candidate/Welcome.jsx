import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCandidate, useChecklist, useDocuments } from '../../hooks/useData'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
function daysSince(dateStr) {
  return Math.max(0, Math.floor((new Date() - new Date(dateStr)) / 86400000))
}

export default function Welcome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const name = user?.name?.split(' ')[0] || 'there'

  const { data: emp, isLoading: empLoading } = useCandidate(user?.candidate_id)
  const { data: checklist = [] } = useChecklist(user?.candidate_id)
  const { data: docs = [] } = useDocuments(user?.candidate_id)

  const progress       = emp?.onboarding_progress ?? 0
  const completedTasks = checklist.filter(c => c.completed).length
  const pendingDocs    = docs.filter(d => d.status === 'pending').length
  const idCardItem     = checklist.find(i => i.title === 'ID Card Issued')
  const isSubmitted    = idCardItem?.completed ?? false

  if (empLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading your dashboard…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Hero banner */}
      <div className="rounded-2xl border border-teal-500/10 bg-[#0C1A1D] p-6 sm:p-8 mb-5 sm:mb-7 relative overflow-hidden animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(6,182,212,0.04) 50%, transparent 70%)' }}>
        <div className="absolute top-0 right-0 w-48 sm:w-80 h-48 sm:h-80 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-3 sm:mb-4">
            🎉 Welcome to the team!
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
            Good {getGreeting()}, {name}!
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl">
            {emp
              ? `You're joining as ${emp.position} in ${emp.department}. Your AI-powered guide will walk you through everything.`
              : "We're thrilled to have you here. Your AI-powered onboarding guide will walk you through everything."}
          </p>

          {/* Stats row */}
          <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-1">Progress</p>
              <div className="flex items-center gap-3">
                <div className="w-28 sm:w-40"><ProgressBar value={progress} showLabel={false} /></div>
                <span className="text-white font-bold">{progress}%</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-2xl font-display font-bold text-white leading-none">
                {completedTasks}<span className="text-slate-500 text-base font-normal">/{checklist.length}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Tasks done</p>
            </div>
            {emp?.start_date && <>
              <div className="h-8 w-px bg-white/10 hidden sm:block" />
              <div>
                <p className="text-2xl font-display font-bold text-white leading-none">{daysSince(emp.start_date)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Days since start</p>
              </div>
            </>}
          </div>
        </div>
      </div>

      {/* Bottom grid: stacks on mobile */}
      <div className="grid  gap-4 sm:gap-6">
        {/* Next steps / Completion */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-4 sm:p-5 animate-slide-up opacity-0"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>

          {isSubmitted ? (
            <div className="flex flex-col items-center text-center py-4 sm:py-6 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl">
                🎉
              </div>
              <div>
                <h2 className="font-display font-bold text-white text-base sm:text-lg mb-1">
                  You've completed your onboarding!
                </h2>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  All steps are done and your profile has been submitted. Have questions about company policies or what comes next?
                </p>
              </div>
              <button
                onClick={() => navigate('/onboarding/policy')}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/35 text-teal-400 font-semibold text-sm transition-all duration-200 group">
                <span className="text-lg">💬</span>
                Ask the HR Policy Bot
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-display font-semibold text-white mb-4 text-sm sm:text-base">Next Steps</h2>
              <div className="space-y-2 sm:space-y-3">
            {[
              {
                icon: '📄', title: 'Upload Documents',
                desc: pendingDocs > 0 ? `${pendingDocs} document${pendingDocs > 1 ? 's' : ''} pending` : 'All documents uploaded ✓',
                action: () => navigate('/onboarding/documents'),
                urgent: pendingDocs > 0,
              },
              {
                icon: '✅', title: 'Complete Checklist',
                desc: checklist.length - completedTasks > 0
                  ? `${checklist.length - completedTasks} tasks remaining`
                  : 'All tasks complete ✓',
                action: () => navigate('/onboarding/checklist'),
                urgent: false,
              },
              {
                icon: '💬', title: 'Ask HR Bot',
                desc: 'Get instant answers about policies',
                action: () => navigate('/onboarding/policy'),
                urgent: false,
              },
            ].map((item, i) => (
              <button key={i} onClick={item.action}
                className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl text-left transition-all duration-200 border group
                  ${item.urgent
                    ? 'bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-teal-500/20 hover:bg-teal-500/[0.03]'}`}>
                <span className="text-xl sm:text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{item.desc}</p>
                </div>
                {item.urgent && (
                  <span className="text-[10px] sm:text-xs bg-amber-500/15 text-amber-400 px-1.5 sm:px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    Action needed
                  </span>
                )}
                <span className="text-slate-600 group-hover:text-teal-400 transition-colors flex-shrink-0">→</span>
              </button>
            ))}
          </div>
            </>
          )}
        </div>


      </div>
    </div>
  )
}