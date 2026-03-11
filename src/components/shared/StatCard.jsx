export default function StatCard({ label, value, icon, sub, color = 'teal', delay = 0 }) {
  const colors = {
    teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    text: 'text-cyan-400' },
    // legacy aliases
    indigo:  { bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400' },
    violet:  { bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400' },
  }
  const c = colors[color] || colors.teal
  return (
    <div
      className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-4 sm:p-5 animate-slide-up opacity-0"
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
        backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 60%)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 mr-2">
          <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">{label}</p>
          <p className="text-3xl sm:text-4xl font-display font-bold text-white mt-1.5 sm:mt-2 tracking-tight">{value}</p>
          {sub && <p className="text-[11px] sm:text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg} border ${c.border}`}>
          <span className="text-lg sm:text-xl">{icon}</span>
        </div>
      </div>
    </div>
  )
}