export default function ProgressBar({ value, showLabel = true, size = 'md', color = 'accent' }) {
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' }
  const colors = {
    accent:  'from-teal-500 to-cyan-500',
    success: 'from-emerald-500 to-teal-500',
    warning: 'from-amber-500 to-orange-500',
    danger:  'from-red-500 to-rose-500',
  }
  const pct      = Math.min(100, Math.max(0, value))
  const colorKey = pct === 100 ? 'success' : pct < 30 ? 'danger' : pct < 70 ? 'warning' : color

  return (
    <div className="w-full">
      <div className={`w-full bg-white/[0.06] rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[colorKey]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <p className="text-xs text-slate-500 mt-1 text-right">{pct}%</p>}
    </div>
  )
}