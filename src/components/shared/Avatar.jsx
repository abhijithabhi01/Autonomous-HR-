const COLORS = [
  'from-teal-500 to-cyan-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-teal-600',
]

export default function Avatar({ initials, size = 'md', index = 0 }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl',
  }
  const color = COLORS[index % COLORS.length]
  return (
    <div className={`${sizes[size]} rounded-xl bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white flex-shrink-0 shadow-lg`}>
      {initials}
    </div>
  )
}