import { useAuth } from '../../hooks/useAuth'
import { useChecklist, useToggleChecklist } from '../../hooks/useData'
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

export default function Checklist() {
  const { user } = useAuth()
  const { data: items = [], isLoading } = useChecklist(user?.candidate_id)
  const toggleMutation = useToggleChecklist()

  const completed = items.filter(i => i.completed).length
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0

  const toggle = (item) => {
    if (toggleMutation.isPending) return
    const next = !item.completed
    toggleMutation.mutate(
      { id: item.id, completed: next, candidateId: user?.candidate_id },
      { onSuccess: () => { if (next) toast.success('Task completed! 🎉') } }
    )
  }

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
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Onboarding Checklist</h1>
        <p className="text-slate-500 text-sm mt-1">Track and complete your onboarding tasks</p>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-5 sm:p-6 mb-6 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)' }}>
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
        {pct === 100 && (
          <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-center">
            <p className="text-teal-400 font-semibold text-sm">🎉 Onboarding complete! Welcome aboard.</p>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📋</p>
          <p>No checklist items assigned yet</p>
        </div>
      )}

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
                {catItems.map(item => (
                  <div key={item.id} onClick={() => toggle(item)}
                    className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-200 group
                      ${toggleMutation.isPending ? 'pointer-events-none opacity-70' : ''}
                      ${item.completed
                        ? 'bg-white/[0.01] border-white/[0.03] opacity-55'
                        : 'bg-[#0C1A1D] border-white/[0.05] hover:border-teal-500/20 hover:bg-teal-500/[0.03]'}`}>
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all
                      ${item.completed
                        ? 'bg-emerald-500/20 border-emerald-500/40'
                        : 'bg-white/[0.03] border-white/10 group-hover:border-teal-500/40'}`}>
                      {item.completed && <span className="text-emerald-400 text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold transition-colors
                        ${item.completed ? 'line-through text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      {item.completed_at && (
                        <p className="text-[10px] text-teal-700 mt-1">
                          ✓ Completed {new Date(item.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {!item.completed && (
                      <span className="text-xs text-slate-600 group-hover:text-teal-400 transition-colors font-medium opacity-0 group-hover:opacity-100 whitespace-nowrap hidden sm:block">
                        Mark done
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}