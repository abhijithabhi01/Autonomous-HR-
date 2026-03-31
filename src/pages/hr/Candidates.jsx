import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidates, useAddCandidate, useDeleteCandidate } from '../../hooks/useData'
import toast from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const FILTERS     = ['All', 'Pre-Joining', 'Onboarding']
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Finance', 'HR', 'Operations', 'Sales', 'Legal']

const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const api  = (path) => BASE ? `${BASE}${path}` : path

const EMPTY_FORM = {
  full_name:      '',
  personal_email: '',
  position:       '',
  department:     'Engineering',
  manager:        '',
  location:       '',
  start_date:     null,
}

// ── Helpers ────────────────────────────────────────────────────
function isWeekday(date) {
  const d = date.getDay()
  return d !== 0 && d !== 6
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = e => resolve(e.target.result.split(',')[1])
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsDataURL(file)
  })
}

// ── Reusable field ─────────────────────────────────────────────
function Field({ label, name, type = 'text', required, value, onChange, error, hint, highlight, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          {...rest}
          className={`w-full bg-[#080C18] border rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600
            focus:outline-none transition-all
            ${error     ? 'border-red-500/50 focus:border-red-500/70' :
              highlight  ? 'border-teal-500/50 focus:border-teal-500/70' :
                           'border-white/[0.08] focus:border-indigo-500/50'}`}
        />
        {highlight && !error && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 text-xs font-semibold">✦ auto</span>
        )}
      </div>
      {hint  && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ── Offer-letter upload zone ───────────────────────────────────
// States: idle | dragging | scanning | valid | invalid
function OfferLetterZone({ onExtracted, onFileSelected, file, scanState, flags, confidence }) {
  const inputRef    = useRef(null)
  const [drag, setDrag] = useState(false)

  const handleFile = useCallback((f) => {
    if (!f) return
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    if (!ok) { toast.error('Upload a PDF or image (JPG/PNG/WEBP)'); return }
    onFileSelected(f)
  }, [onFileSelected])

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  // Colour / icon based on state
  const stateMap = {
    idle:     { border: 'border-white/[0.08]',     bg: 'bg-transparent',          icon: '📄', label: 'Drop offer letter here, or click to upload' },
    dragging: { border: 'border-indigo-500/60',     bg: 'bg-indigo-500/5',         icon: '📂', label: 'Drop it!' },
    scanning: { border: 'border-amber-500/40',      bg: 'bg-amber-500/5',          icon: null,  label: 'Reading offer letter with Gemini…' },
    valid:    { border: 'border-teal-500/50',        bg: 'bg-teal-500/5',           icon: '✅', label: file?.name },
    invalid:  { border: 'border-red-500/40',        bg: 'bg-red-500/5',            icon: '❌', label: flags?.[0] || 'Invalid document' },
  }

  const s = stateMap[scanState] || stateMap.idle

  console.log() 
  return (
    <div className="col-span-2">
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
        Offer Letter <span className="text-indigo-400 normal-case font-normal ml-1">— auto-fill form via AI</span>
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => scanState !== 'scanning' && inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          cursor-pointer transition-all duration-200 py-5 px-4 select-none
          ${drag ? stateMap.dragging.border + ' ' + stateMap.dragging.bg : s.border + ' ' + s.bg}
          ${scanState === 'scanning' ? 'pointer-events-none' : 'hover:border-indigo-500/40 hover:bg-indigo-500/5'}`}
      >
        {scanState === 'scanning' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <p className="text-xs text-amber-400 font-medium">{s.label}</p>
          </div>
        ) : (
          <>
            {s.icon && <span className="text-2xl leading-none">{s.icon}</span>}
            <p className={`text-xs font-medium text-center max-w-xs ${
              scanState === 'valid'   ? 'text-teal-400' :
              scanState === 'invalid' ? 'text-red-400' :
                                       'text-slate-500'}`}>
              {s.label}
            </p>
            {scanState === 'idle' && (
              <p className="text-[10px] text-slate-600">PDF · JPG · PNG · WEBP · max 15 MB</p>
            )}
            {scanState === 'valid' && confidence > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1 w-16 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${confidence}%` }} />
                </div>
                <span className="text-[10px] text-teal-500">{confidence}% confidence</span>
              </div>
            )}
            {scanState === 'invalid' && (
              <button
                onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                className="mt-1 text-[10px] text-slate-400 underline underline-offset-2 hover:text-slate-200">
                Try another file
              </button>
            )}
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden" onChange={e => handleFile(e.target.files[0])} />
    </div>
  )
}

// ── Document preview panel (right side) ───────────────────────
function DocPreview({ file, objectUrl, scanState, fields, flags, onClose }) {
  if (!file) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">
            {scanState === 'valid' ? '✅' : scanState === 'invalid' ? '❌' : '📄'}
          </span>
          <p className="text-xs font-semibold text-slate-300 truncate">{file.name}</p>
        </div>
        <button onClick={onClose}
          className="ml-2 shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all text-sm">
          ✕
        </button>
      </div>

      {/* Document render */}
      <div className="flex-1 overflow-hidden bg-[#060A14] relative">
        {file.type === 'application/pdf' ? (
          <iframe
            src={objectUrl}
            title="Offer letter preview"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-3">
            <img src={objectUrl} alt="Offer letter" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        )}
      </div>

      {/* Extracted fields chip list */}
      {scanState === 'valid' && (
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Fields filled by AI</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(fields)
              .filter(([, v]) => v && String(v).trim())
              .map(([k]) => (
                <span key={k}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  {k.replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Flags / warnings */}
      {flags?.length > 0 && (
        <div className="shrink-0 px-4 pb-3">
          {flags.map((f, i) => (
            <p key={i} className="text-[10px] text-amber-400 mt-1">⚠ {f}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Candidate Modal ─────────────────────────────────────────
function AddCandidateModal({ onClose, onSave, isLoading }) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  // OCR state
  const [offerFile, setOfferFile] = useState(null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [scanState, setScanState] = useState('idle')   // idle|scanning|valid|invalid
  const [ocrFlags, setOcrFlags]   = useState([])
  const [ocrConf, setOcrConf]     = useState(0)
  const [autoFields, setAutoFields] = useState({})     // track which fields were auto-filled
  const [showPreview, setShowPreview] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Cleanup object URL on unmount / file change
  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [objectUrl])

  // ── When HR picks a file: OCR it immediately ─────────────────
  const handleFileSelected = useCallback(async (file) => {
    // Revoke old URL
    setObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    setOfferFile(file)
    setShowPreview(true)
    setScanState('scanning')
    setOcrFlags([])

    try {
      const base64 = await fileToBase64(file)
      const res    = await fetch(api('/api/candidates/extract-offer-letter'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ base64, mimeType: file.type }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

      if (!data.valid) {
        setScanState('invalid')
        setOcrFlags(data.flags || [])
        toast.error(data.flags?.[0] || 'Document rejected')
        return
      }

      // ── Merge extracted fields into form (only non-empty) ────
      const extracted = data.fields || {}
      const filled    = {}

      setForm(prev => {
        const next = { ...prev }
        const merge = (key, transform) => {
          const val = transform ? transform(extracted[key]) : extracted[key]
          if (val && String(val).trim()) { next[key] = val; filled[key] = true }
        }

        merge('full_name')
        merge('personal_email')
        merge('position')
        merge('department')
        merge('manager')
        merge('location')
        // start_date: backend sends ISO string or null
        if (extracted.start_date) {
          const d = new Date(extracted.start_date)
          if (!isNaN(d)) { next.start_date = d; filled['start_date'] = true }
        }

        return next
      })

      setAutoFields(filled)
      setScanState('valid')
      setOcrConf(data.confidence || 80)
      setOcrFlags(data.flags || [])

      const filledCount = Object.keys(filled).length
      if (filledCount > 0) {
        toast.success(`✦ ${filledCount} field${filledCount > 1 ? 's' : ''} filled from offer letter`, {
          style: {
            background: '#0C1120', color: '#2DD4BF',
            border: '1px solid rgba(45,212,191,0.25)', borderRadius: '12px', fontSize: '13px',
          },
        })
      }
    } catch (err) {
      console.error('[OCR]', err)
      setScanState('invalid')
      setOcrFlags(['Could not read document — ' + err.message])
      toast.error('OCR failed: ' + err.message)
    }
  }, [])

  const clearOffer = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setOfferFile(null)
    setObjectUrl(null)
    setScanState('idle')
    setOcrFlags([])
    setAutoFields({})
    setShowPreview(false)
  }

  // ── Validation ───────────────────────────────────────────────
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
      e.start_date = 'Start date is required'
    } else {
      const sel   = new Date(form.start_date); sel.setHours(0, 0, 0, 0)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const day   = sel.getDay()
      if (sel <= today) e.start_date = 'Date must be after today'
      else if (day === 0 || day === 6) e.start_date = 'Weekends are not allowed'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => { if (validate()) onSave(form) }

  // ── Layout: side-by-side when preview is open ────────────────
  const wideLayout = showPreview && offerFile

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-[#0D1120] border border-white/[0.08] rounded-2xl shadow-2xl
          animate-slide-up opacity-0 transition-all duration-300 flex overflow-hidden
          ${wideLayout
            ? 'w-full max-w-4xl h-[88vh]'
            : 'w-full max-w-lg'}`}
        style={{ animationFillMode: 'forwards' }}>

        {/* ── LEFT: Form ─────────────────────────────────────── */}
        <div className={`flex flex-col ${wideLayout ? 'w-[420px] shrink-0 border-r border-white/[0.06]' : 'w-full'}`}>

          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
            <div>
              <h2 className="font-display font-bold text-white text-lg leading-tight">Add Candidate</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                {scanState === 'valid'
                  ? `✦ ${Object.keys(autoFields).length} fields auto-filled from offer letter`
                  : 'Upload offer letter to auto-fill form'}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all text-lg">
              ✕
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">

            {/* Offer letter zone */}
            <OfferLetterZone
              onExtracted={() => {}}
              onFileSelected={handleFileSelected}
              file={offerFile}
              scanState={scanState}
              flags={ocrFlags}
              confidence={ocrConf}
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[10px] text-slate-600 uppercase tracking-widest">Candidate Details</span>
              <div className="flex-1 h-px bg-white/[0.05]" />
            </div>

            {/* Full Name */}
            <div className="col-span-2">
              <Field label="Full Name" name="full_name" required
                value={form.full_name} onChange={set}
                error={errors.full_name}
                highlight={!!autoFields.full_name} />
            </div>

            {/* Personal Email */}
            <Field label="Personal Email" name="personal_email" type="email" required
              hint="Login credentials are emailed here. Work email is auto-generated."
              value={form.personal_email} onChange={set}
              error={errors.personal_email}
              highlight={!!autoFields.personal_email} />

            {/* Position */}
            <Field label="Job Title / Position" name="position" required
              value={form.position} onChange={set}
              error={errors.position}
              highlight={!!autoFields.position} />

            <div className="grid grid-cols-2 gap-3">
              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Department
                  {autoFields.department && <span className="ml-1 text-teal-400 normal-case font-normal">✦ auto</span>}
                </label>
                <select value={form.department} onChange={e => set('department', e.target.value)}
                  className={`w-full bg-[#080C18] border rounded-xl px-4 py-2.5 text-sm text-slate-200
                    focus:outline-none focus:border-indigo-500/50 transition-all
                    ${autoFields.department ? 'border-teal-500/50' : 'border-white/[0.08]'}`}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Start Date <span className="text-red-400 ml-0.5">*</span>
                  {autoFields.start_date && <span className="ml-1 text-teal-400 normal-case font-normal">✦ auto</span>}
                </label>
                <DatePicker
                  selected={form.start_date}
                  onChange={date => set('start_date', date)}
                  minDate={new Date()}
                  filterDate={date => {
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    return date > today && isWeekday(date)
                  }}
                  dayClassName={date => (!isWeekday(date) ? 'text-red-500' : '')}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select start date"
                  className={`w-full bg-[#080C18] border rounded-xl px-4 py-2.5 text-sm text-slate-200
                    focus:outline-none focus:border-indigo-500/50
                    ${errors.start_date    ? 'border-red-500/50' :
                      autoFields.start_date ? 'border-teal-500/50' :
                                             'border-white/[0.08]'}`}
                  popperPlacement="bottom-start"
                />
                {errors.start_date && (
                  <p className="text-red-400 text-xs mt-1">{errors.start_date}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Manager" name="manager"
                value={form.manager} onChange={set} error={errors.manager}
                highlight={!!autoFields.manager} />
              <Field label="Location" name="location"
                value={form.location} onChange={set} error={errors.location}
                highlight={!!autoFields.location} />
            </div>

            {/* AI auto-fill legend */}
            {Object.keys(autoFields).length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-teal-500/5 border border-teal-500/15">
                <span className="text-teal-400 text-sm">✦</span>
                <p className="text-[11px] text-teal-500">
                  Teal fields were auto-filled from the offer letter. Review before saving.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06] shrink-0">
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

        {/* ── RIGHT: Document preview ─────────────────────────── */}
        {wideLayout && (
          <div className="flex-1 overflow-hidden">
            <DocPreview
              file={offerFile}
              objectUrl={objectUrl}
              scanState={scanState}
              fields={form}
              flags={ocrFlags}
              onClose={clearOffer}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ───────────────────────────────────
function DeleteModal({ candidate, onClose, onConfirm, isLoading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-red-500/20 rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards' }}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mx-auto mb-4">🗑</div>
          <h2 className="font-display font-bold text-white text-lg text-center mb-1">Remove Candidate</h2>
          <p className="text-slate-400 text-sm text-center mb-5">
            Are you sure you want to remove{' '}
            <span className="text-white font-semibold">{candidate?.full_name}</span>?
            This will delete all their documents and checklist data permanently.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Yes, Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function Candidates() {
  const navigate = useNavigate()
  const { data: candidates = [], isLoading } = useCandidates()
  const addMutation    = useAddCandidate()
  const deleteMutation = useDeleteCandidate()

  const [filter, setFilter]         = useState('All')
  const [search, setSearch]         = useState('')
  const [showAddModal, setShowAdd]  = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const isOpen = showAddModal || !!deleteTarget
    window.dispatchEvent(new CustomEvent('hr:modal', { detail: { open: isOpen } }))
  }, [showAddModal, deleteTarget])

  const filtered = candidates.filter(c => {
    const matchFilter =
      filter === 'Pre-Joining' ? c.onboarding_status === 'pre_joining' :
      filter === 'Onboarding'  ? c.onboarding_status === 'onboarding' : true
    const q = search.toLowerCase()
    return matchFilter && (
      c.full_name.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q)  ||
      c.department.toLowerCase().includes(q)
    )
  })

  const handleAdd = (fields) => {
    addMutation.mutate(fields, {
      onSuccess: () => setShowAdd(false),
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
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
          style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
          <span className="text-base leading-none">+</span> Add Candidate
        </button>
      </div>

      {/* Search */}
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
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 60%)',
              }}>

              <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl ${
                c.onboarding_status === 'onboarding' ? 'bg-indigo-500' : 'bg-amber-500'}`} />

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