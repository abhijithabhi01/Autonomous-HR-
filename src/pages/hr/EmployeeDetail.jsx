import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidate, useEmployee, useDocuments, useChecklist } from '../../hooks/useData'

const DOC_STATUS_ICON = { verified: '✅', uploaded: '📤', pending: '⏳', failed: '❌', flagged: '⚠️' }

const CATEGORY_COLORS = {
  legal:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  documents: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  it:        'bg-teal-500/10 text-teal-400 border-teal-500/20',
  hr:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  training:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  social:    'bg-pink-500/10 text-pink-400 border-pink-500/20',
  wellbeing: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function EmployeeDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Detect which table to query based on the route
  const isCandidate = location.pathname.startsWith('/hr/candidates/')

  const { data: candidate, isLoading: candLoading } = useCandidate(isCandidate ? id : null)
  const { data: employee,  isLoading: empLoading  } = useEmployee(!isCandidate ? id : null)

  const person    = isCandidate ? candidate : employee
  const isLoading = isCandidate ? candLoading : empLoading

  // Documents and checklist are always linked to candidate_id
  // For employees, use their candidate_id (the original onboarding record)
  const candidateId = isCandidate ? id : employee?.candidate_id
  const { data: docs  = [], isLoading: docsLoading  } = useDocuments(candidateId)
  const { data: items = [], isLoading: checkLoading } = useChecklist(candidateId)

  const backTo    = isCandidate ? '/hr/candidates' : '/hr/employees'
  const backLabel = isCandidate ? '← Back to Candidates' : '← Back to Employees'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text={`Loading ${isCandidate ? 'candidate' : 'employee'}…`} />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-4xl mb-3">👤</p>
        <p>{isCandidate ? 'Candidate' : 'Employee'} not found</p>
        <button onClick={() => navigate(backTo)} className="mt-4 text-teal-400 text-sm hover:underline">
          {backLabel}
        </button>
      </div>
    )
  }

  const completedChecks = items.filter(c => c.completed).length
  const verifiedDocs    = docs.filter(d => d.status === 'verified').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(backTo)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-5 animate-fade-in">
        {backLabel}
      </button>

      {/* Profile header */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-5 sm:p-6 mb-5 sm:mb-6 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)' }}>
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          <Avatar initials={person.avatar} size="xl" index={0} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{person.full_name}</h1>
              {isCandidate
                ? <StatusBadge status={person.onboarding_status} />
                : <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">✓ Active Employee</span>
              }
            </div>
            <p className="text-slate-400 text-sm">{person.position} · {person.department}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs text-slate-500">
              <span>📧 {person.work_email}</span>
              {person.location  && <span>📍 {person.location}</span>}
              {person.start_date && <span>🗓️ Started {person.start_date}</span>}
              {person.manager   && <span>👤 {person.manager}</span>}
              {!isCandidate && person.joined_at && (
                <span>🎓 Graduated {new Date(person.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              )}
            </div>
          </div>
          {isCandidate && (
            <div className="sm:text-right w-full sm:w-auto">
              <p className="text-xs text-slate-500 mb-1">Progress</p>
              <p className="text-3xl font-display font-bold text-white">{person.onboarding_progress}%</p>
              <div className="w-full sm:w-32 mt-2"><ProgressBar value={person.onboarding_progress} showLabel={false} /></div>
            </div>
          )}
        </div>
      </div>

      {/* Docs + Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-6">
        {/* Documents */}
        <div className="md:col-span-2 rounded-2xl border border-white/[0.05] bg-[#0C1A1D] overflow-hidden animate-slide-up opacity-0"
          style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
          <div className="px-4 sm:px-5 py-4 border-b border-white/[0.05]">
            <h2 className="font-display font-semibold text-white text-sm">Documents</h2>
            <p className="text-xs text-slate-500 mt-0.5">{verifiedDocs}/{docs.length} verified</p>
          </div>
          {docsLoading
            ? <div className="py-8 flex justify-center"><LoadingSpinner size="sm" /></div>
            : docs.length === 0
              ? <div className="py-8 text-center text-slate-500 text-sm">No documents uploaded yet</div>
              : (
                <div className="divide-y divide-white/[0.04]">
                  {docs.map(doc => (
                    <div key={doc.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
                      <span className="text-lg">{doc.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">{doc.label}</p>
                        {doc.expiry_date && (
                          <p className={`text-xs mt-0.5 ${doc.days_until_expiry < 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                            Exp. {doc.expiry_date}
                            {doc.days_until_expiry < 60 && ` · ⚠️ ${doc.days_until_expiry}d`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{DOC_STATUS_ICON[doc.status] || '⏳'}</span>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>

        {/* Checklist */}
        <div className="md:col-span-3 rounded-2xl border border-white/[0.05] bg-[#0C1A1D] overflow-hidden animate-slide-up opacity-0"
          style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}>
          <div className="px-4 sm:px-5 py-4 border-b border-white/[0.05]">
            <h2 className="font-display font-semibold text-white text-sm">Onboarding Checklist</h2>
            <p className="text-xs text-slate-500 mt-0.5">{completedChecks}/{items.length} tasks completed</p>
          </div>
          {checkLoading
            ? <div className="py-8 flex justify-center"><LoadingSpinner size="sm" /></div>
            : items.length === 0
              ? <div className="py-8 text-center text-slate-500 text-sm">No checklist items</div>
              : (
                <div className="divide-y divide-white/[0.04] max-h-80 sm:max-h-96 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center border
                        ${item.completed ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-white/[0.03] border-white/10'}`}>
                        {item.completed && <span className="text-emerald-400 text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {item.title}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.hr}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                        {item.completed_at && (
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            Completed {new Date(item.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>
    </div>
  )
}