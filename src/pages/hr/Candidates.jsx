import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidates, useAddCandidate, useDeleteCandidate } from '../../hooks/useData'
import toast from 'react-hot-toast'
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"


const FILTERS = ['All', 'Pre-Joining', 'Onboarding']
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Finance', 'HR', 'Operations', 'Sales', 'Legal']

// tomorrow's date as YYYY-MM-DD — used for both default and min
function nextValidDate() {
  const d = new Date()
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6) // skip Sun/Sat
  return d.toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  full_name: '',
  personal_email: '',
  position: '',
  department: 'Engineering',
  manager: '',
  location: '',
   start_date: new Date(),   // default = tomorrow, never today
}

// Field supports extra HTML input props (e.g. min, max) via ...rest
function Field({ label, name, type = 'text', required, value, onChange, error, hint, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        {...rest}
        className={`w-full bg-[#080C18] border rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600
          focus:outline-none focus:border-indigo-500/50 transition-all
          ${error ? 'border-red-500/50' : 'border-white/[0.08]'}`}
      />
      {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ── Add Candidate Modal ─────────────────────────────────────
function AddCandidateModal({ onClose, onSave, isLoading }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}

    if (!form.full_name.trim()) e.full_name = 'Full name is required'
    else if (form.full_name.trim().length < 3) e.full_name = 'Must be at least 3 characters'

    if (!form.personal_email.trim())
      e.personal_email = 'Personal email is required — credentials are sent here'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personal_email))
      e.personal_email = 'Enter a valid email address'

    if (!form.position.trim()) e.position = 'Position is required'

    if (!form.start_date) {
      e.start_date = 'Last date is required'
    } else {
      const selected = form.start_date
      const today = new Date()

      // normalize time
      today.setHours(0, 0, 0, 0)
      selected.setHours(0, 0, 0, 0)

      const day = selected.getDay() // 0 = Sunday, 6 = Saturday

      if (selected <= today) {
        e.start_date = 'Date must be after today'
      } else if (day === 0 || day === 6) {
        e.start_date = 'Weekends (Saturday & Sunday) are not allowed'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => { if (validate()) onSave(form) }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards' }}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Add Candidate</h2>
            <p className="text-slate-500 text-xs mt-0.5">Work email is auto-generated from their name</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all text-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <Field label="Full Name" name="full_name" required
                value={form.full_name} onChange={set} error={errors.full_name} />
            </div>

            <div className="col-span-2">
              <Field label="Personal Email" name="personal_email" type="email" required
                hint="Login credentials are emailed here. Work email (firstname.lastname@dcompany.com) is auto-generated."
                value={form.personal_email} onChange={set} error={errors.personal_email} />
            </div>

            <div className="col-span-2">
              <Field label="Job Title / Position" name="position" required
                value={form.position} onChange={set} error={errors.position} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

          <div className="col-span-1">
  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
    Last Date *
  </label>

  <DatePicker
    selected={form.start_date}
    onChange={(date) => set('start_date', date)}

    minDate={new Date()}

    filterDate={(date) => {
      const day = date.getDay()
      const today = new Date()
      today.setHours(0,0,0,0)

      return (
        date > today &&
        day !== 0 &&
        day !== 6
      )
    }}

    dayClassName={(date) => {
      const day = date.getDay()
      if (day === 0 || day === 6) return "text-red-500"
      return ""
    }}

    dateFormat="dd/MM/yyyy"

    placeholderText="Select start date"

    className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"

    popperPlacement="bottom-start"
  />
</div>

            <Field label="Manager" name="manager"
              value={form.manager} onChange={set} error={errors.manager} />
            <Field label="Location" name="location"
              value={form.location} onChange={set} error={errors.location} />

          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2"
            style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
            {isLoading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              : 'Add Candidate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ───────────────────────────────
function DeleteModal({ candidate, onClose, onConfirm, isLoading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-red-500/20 rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards' }}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mx-auto mb-4">🗑</div>
          <h2 className="font-display font-bold text-white text-lg text-center mb-1">Remove Candidate</h2>
          <p className="text-slate-400 text-sm text-center mb-5">
            Are you sure you want to remove <span className="text-white font-semibold">{candidate?.full_name}</span>?
            This will delete all their documents and checklist data permanently.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Yes, Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────
export default function Candidates() {
  const navigate = useNavigate()
  const { data: candidates = [], isLoading } = useCandidates()
  const addMutation = useAddCandidate()
  const deleteMutation = useDeleteCandidate()

  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Tell HRLayout to pause realtime polling whenever a modal is open.
  // This prevents the 30s poll from invalidating queries mid-form, which
  // would cause a re-render that resets the modal's input state.
  useEffect(() => {
    const isOpen = showAddModal || !!deleteTarget
    window.dispatchEvent(new CustomEvent('hr:modal', { detail: { open: isOpen } }))
  }, [showAddModal, deleteTarget])

  const filtered = candidates.filter(c => {
    const matchFilter =
      filter === 'Pre-Joining' ? c.onboarding_status === 'pre_joining' :
        filter === 'Onboarding' ? c.onboarding_status === 'onboarding' : true
    const q = search.toLowerCase()
    return matchFilter && (
      c.full_name.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q)
    )
  })

  const handleAdd = (fields) => {
    // Use mutate() (not mutateAsync) and pass onSuccess/onError as callbacks.
    // This avoids try/catch in the component and removes the chance of
    // accidentally re-opening the modal.  The modal stays open while the
    // mutation is pending (spinner is shown), then closes on success.
    addMutation.mutate(fields, {
      onSuccess: () => setShowAdd(false),
      // On error the toast is already shown by useAddCandidate onError.
      // We intentionally keep the modal open so HR can fix and retry.
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
    } catch {
      toast.error('Failed to remove candidate')
    }
    setDeleteTarget(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading candidates…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Candidates</h1>
          <p className="text-slate-500 text-sm mt-1">
            {candidates.filter(c => c.onboarding_status === 'onboarding').length} onboarding ·{' '}
            {candidates.filter(c => c.onboarding_status === 'pre_joining').length} pre-joining
          </p>
        </div>
        <div className="flex items-center gap-3">

          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
            style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
            <span className="text-base leading-none">+</span> Add Candidate
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="w-full bg-[#0D1120] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all" />
        </div>

      </div>

      {/* Empty state */}
      {candidates.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎯</p>
          <p className="font-semibold text-slate-300 text-lg">No candidates yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">Add new hires going through onboarding</p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
            Add Candidate
          </button>
        </div>
      )}

      {/* Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <div key={c.id}
              onClick={() => navigate(`/hr/candidates/${c.id}`)}
              className="rounded-2xl border border-white/[0.06] bg-[#0D1120] p-5 hover:border-indigo-500/20 hover:-translate-y-0.5 transition-all duration-200 animate-slide-up opacity-0 cursor-pointer group relative"
              style={{
                animationDelay: `${i * 60}ms`, animationFillMode: 'forwards',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 60%)'
              }}>

              <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl ${c.onboarding_status === 'onboarding' ? 'bg-indigo-500' : 'bg-amber-500'
                }`} />

              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Remove candidate">
                🗑
              </button>

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar initials={c.avatar} size="md" index={i} />
                  <div>
                    <p className="font-semibold text-slate-200 text-sm group-hover:text-white transition-colors">{c.full_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.position}</p>
                  </div>
                </div>
                <StatusBadge status={c.onboarding_status} />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>🏢</span><span>{c.department}</span>
                </div>
                {c.location && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>📍</span><span>{c.location}</span>
                  </div>
                )}
                {c.manager && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>👤</span><span>Manager: {c.manager}</span>
                  </div>
                )}
                {c.start_date && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>📅</span>
                    <span>Starts {new Date(c.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Onboarding progress</span>
                  <span className="font-semibold text-slate-300">{c.onboarding_progress}%</span>
                </div>
                <ProgressBar value={c.onboarding_progress} showLabel={false} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {candidates.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-3xl mb-2">🔍</p>
          <p>No candidates match your search</p>
        </div>
      )}

      {showAddModal && (
        <AddCandidateModal
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
          isLoading={addMutation.isPending}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          candidate={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}