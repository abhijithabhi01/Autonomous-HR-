import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Avatar from "../../components/shared/Avatar"
import LoadingSpinner from "../../components/shared/LoadingSpinner"
import { useEmployees } from "../../hooks/useData"

// ── Main Page ─────────────────────────────────────────────────
export default function Employees() {
  const navigate = useNavigate()
  const { data: all = [], isLoading } = useEmployees()

  const employees = all

  const [search, setSearch] = useState('')

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      e.full_name.toLowerCase().includes(q)  ||
      e.position.toLowerCase().includes(q)   ||
      e.department.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Employees</h1>
          <p className="text-slate-500 text-sm mt-1">{employees.length} active staff · Graduated from onboarding</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 animate-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
        <div className="relative max-w-sm">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="w-full bg-[#0D1120] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all" />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" text="Loading employees…" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🏢</p>
          <p className="font-semibold text-slate-300 text-lg">No employees yet</p>
          <p className="text-sm text-slate-500 mt-1">Employees appear here automatically once candidates complete onboarding</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((emp, i) => (
            <div key={emp.id}
              onClick={() => navigate(`/hr/employees/${emp.id}`)}
              className="rounded-2xl border border-white/[0.06] bg-[#0D1120] p-5 hover:border-emerald-500/20 hover:-translate-y-0.5 transition-all duration-200 animate-slide-up opacity-0 group relative cursor-pointer"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 60%)' }}>

              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-emerald-500/60" />

              <div className="flex items-start gap-3 mb-4">
                <Avatar initials={emp.avatar} size="md" index={i} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200 text-sm group-hover:text-white transition-colors truncate">{emp.full_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{emp.position}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    ✓ Active
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>🏢</span><span>{emp.department}</span>
                </div>
                {emp.location && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>📍</span><span>{emp.location}</span>
                  </div>
                )}
                {emp.manager && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>👤</span><span>Manager: {emp.manager}</span>
                  </div>
                )}
                {emp.joined_at && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>🎓</span>
                    <span>Joined {new Date(emp.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {employees.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-3xl mb-2">🔍</p>
          <p>No employees match your search</p>
        </div>
      )}
    </div>
  )
}