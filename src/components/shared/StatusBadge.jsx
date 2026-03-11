export default function StatusBadge({ status }) {
  const map = {
    verified:    { label: 'Verified',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',  dot: 'bg-emerald-400' },
    uploaded:    { label: 'Uploaded',     cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',           dot: 'bg-cyan-400' },
    pending:     { label: 'Pending',      cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20',        dot: 'bg-slate-400' },
    failed:      { label: 'Failed',       cls: 'bg-red-500/10 text-red-400 border-red-500/20',              dot: 'bg-red-400' },
    flagged:     { label: 'Flagged',      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',        dot: 'bg-amber-400' },
    onboarding:  { label: 'Onboarding',   cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20',           dot: 'bg-teal-400' },
    completed:   { label: 'Completed',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',  dot: 'bg-emerald-400' },
    pre_joining: { label: 'Pre-Joining',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',        dot: 'bg-amber-400' },
    high:        { label: 'High',         cls: 'bg-red-500/10 text-red-400 border-red-500/20',              dot: 'bg-red-400' },
    medium:      { label: 'Medium',       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',        dot: 'bg-amber-400' },
    low:         { label: 'Low',          cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',  dot: 'bg-emerald-400' },
  }
  const cfg = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}