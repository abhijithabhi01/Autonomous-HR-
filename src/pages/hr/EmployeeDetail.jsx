import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Avatar from '../../components/shared/Avatar'
import StatusBadge from '../../components/shared/StatusBadge'
import ProgressBar from '../../components/shared/ProgressBar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCandidate, useEmployee, useDocuments, useChecklist, useUploadDocument } from '../../hooks/useData'
import { verifyDocument } from '../../lib/ai'
import toast from 'react-hot-toast'

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

const DOC_TYPES = [
  { value: 'passport',          label: 'Passport',           icon: '🛂', fields: ['name', 'passport_number', 'nationality', 'date_of_birth', 'expiry_date'] },
  { value: 'visa',              label: 'Visa / Work Permit', icon: '📋', fields: ['visa_type', 'holder_name', 'country', 'expiry_date', 'permitted_activities'] },
  { value: 'degree',            label: 'Degree Certificate', icon: '🎓', fields: ['institution', 'degree', 'field_of_study', 'graduation_year', 'student_name'] },
  { value: 'employment_letter', label: 'Employment Letter',  icon: '📄', fields: ['company', 'position', 'employee_name', 'start_date', 'end_date'] },
  { value: 'bank_details',      label: 'Bank Details',       icon: '🏦', fields: ['bank_name', 'account_holder', 'account_type', 'iban_last4'] },
]

const FIELD_LABELS = {
  name: 'Full Name', passport_number: 'Passport Number', nationality: 'Nationality',
  date_of_birth: 'Date of Birth', expiry_date: 'Expiry Date', visa_type: 'Visa Type',
  holder_name: 'Holder Name', country: 'Country', permitted_activities: 'Permitted Activities',
  institution: 'Institution', degree: 'Degree', field_of_study: 'Field of Study',
  graduation_year: 'Graduation Year', student_name: 'Student Name',
  company: 'Company', position: 'Position', employee_name: 'Employee Name',
  start_date: 'Start Date', end_date: 'End Date',
  bank_name: 'Bank Name', account_holder: 'Account Holder',
  account_type: 'Account Type', iban_last4: 'IBAN (last 4)',
}

// ── File to base64 ────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Confidence badge ──────────────────────────────────────────
function ConfidenceBadge({ value }) {
  const color = value >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : value >= 65 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              :               'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {value}% confidence
    </span>
  )
}

// ── Document Upload Modal ─────────────────────────────────────
function DocumentUploadModal({ candidateId, existingTypes = [], onClose }) {
  const uploadMutation = useUploadDocument()

  // Steps: 'select' | 'analyzing' | 'review' | 'saving'
  const [step,         setStep]         = useState('select')
  const [docType,      setDocType]      = useState(DOC_TYPES[0].value)
  const [file,         setFile]         = useState(null)
  const [preview,      setPreview]      = useState(null)
  const [extracted,    setExtracted]    = useState(null)
  const [editedData,   setEditedData]   = useState({})
  const [isDragging,   setIsDragging]   = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const fileRef = useRef()

  const selectedType = DOC_TYPES.find(t => t.value === docType)

  // ── File handling ─────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(f.type)) {
      toast.error('Please upload a JPG, PNG, WebP, or PDF file')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB')
      return
    }
    setFile(f)
    // Preview for images only
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  // ── AI analysis ───────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) { toast.error('Please select a file first'); return }
    setStep('analyzing')
    setAnalyzeError(null)
    try {
      const base64   = await fileToBase64(file)
      const result   = await verifyDocument(base64, file.type, docType)
      setExtracted(result)
      // Pre-populate editable fields
      const initial  = {}
      selectedType.fields.forEach(f => { initial[f] = result[f] ?? '' })
      setEditedData(initial)
      setStep('review')
    } catch (err) {
      setAnalyzeError(err.message || 'AI analysis failed')
      setStep('select')
      toast.error('AI analysis failed — you can still upload manually')
    }
  }

  // ── Skip AI, upload directly ──────────────────────────────
  const handleUploadWithoutAI = async () => {
    if (!file) return
    setStep('saving')
    try {
      await uploadMutation.mutateAsync({ candidateId, docType, file, extractedData: null })
      toast.success('Document uploaded (pending manual review)')
      onClose()
    } catch (err) {
      setStep('select')
      toast.error(err.message)
    }
  }

  // ── Save verified document ────────────────────────────────
  const handleSave = async () => {
    setStep('saving')
    try {
      // Merge edited fields back into extracted data
      const finalData = { ...extracted, ...editedData }
      await uploadMutation.mutateAsync({ candidateId, docType, file, extractedData: finalData })
      toast.success('Document verified and saved ✅')
      onClose()
    } catch (err) {
      setStep('review')
      toast.error(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.22s ease-out both' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Upload & Verify Document</h2>
            <p className="text-slate-500 text-xs mt-0.5">AI will extract and validate the data automatically</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── STEP: SELECT ── */}
          {(step === 'select' || step === 'analyzing') && (
            <>
              {/* Doc type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Document Type
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {DOC_TYPES.map(t => (
                    <button key={t.value} onClick={() => { setDocType(t.value); setFile(null); setPreview(null) }}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all
                        ${docType === t.value
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:border-white/[0.12] hover:text-slate-300'}`}>
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  File <span className="normal-case text-slate-600 font-normal">· JPG, PNG, WebP, PDF · max 10 MB</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer
                    ${isDragging
                      ? 'border-indigo-500/60 bg-indigo-500/[0.06]'
                      : file
                        ? 'border-teal-500/40 bg-teal-500/[0.04]'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.03]'}`}>
                  <input ref={fileRef} type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={e => handleFile(e.target.files[0])} />

                  {/* Image preview */}
                  {preview ? (
                    <div className="p-3">
                      <img src={preview} alt="Preview"
                        className="w-full max-h-44 object-contain rounded-lg" />
                      <p className="text-xs text-center text-teal-400 mt-2 font-medium">
                        ✓ {file.name}
                      </p>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center py-8 gap-2">
                      <span className="text-4xl">📄</span>
                      <p className="text-sm font-semibold text-teal-400">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-300">Drop file here or <span className="text-indigo-400">browse</span></p>
                        <p className="text-xs text-slate-600 mt-0.5">Supports JPG, PNG, WebP, PDF</p>
                      </div>
                    </div>
                  )}

                  {/* Change file overlay */}
                  {file && (
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); fileRef.current.value = '' }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors text-xs">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Error message */}
              {analyzeError && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <span>⚠️</span>
                  <span>{analyzeError}</span>
                </div>
              )}

              {/* AI analyzing spinner */}
              {step === 'analyzing' && (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20">
                  <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-300">AI is analyzing your document…</p>
                    <p className="text-xs text-indigo-400/60 mt-0.5">Extracting fields and checking authenticity</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP: REVIEW ── */}
          {step === 'review' && extracted && (
            <>
              {/* AI verdict */}
              <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border
                ${extracted.is_authentic !== false
                  ? 'bg-emerald-500/[0.07] border-emerald-500/20'
                  : 'bg-red-500/[0.07] border-red-500/20'}`}>
                <span className="text-2xl flex-shrink-0">
                  {extracted.is_authentic !== false ? '✅' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${extracted.is_authentic !== false ? 'text-emerald-300' : 'text-red-300'}`}>
                      {extracted.is_authentic !== false ? 'Document appears authentic' : 'Authenticity concern flagged'}
                    </p>
                    {extracted.confidence > 0 && <ConfidenceBadge value={extracted.confidence} />}
                  </div>
                  {extracted.note && (
                    <p className="text-xs text-slate-500 mt-0.5">{extracted.note}</p>
                  )}
                  {extracted.flags?.length > 0 && (
                    <p className="text-xs text-amber-400 mt-0.5">⚠️ {extracted.flags.join(' · ')}</p>
                  )}
                </div>
              </div>

              {/* File name reminder */}
              <p className="text-xs text-slate-600">
                📎 {file.name} — {selectedType.icon} {selectedType.label}
              </p>

              {/* Extracted fields - editable */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Extracted Data
                  <span className="ml-2 text-slate-600 font-normal normal-case">· Review and correct if needed</span>
                </p>
                <div className="space-y-3">
                  {selectedType.fields.map(fieldKey => (
                    <div key={fieldKey}>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                        {FIELD_LABELS[fieldKey] || fieldKey}
                      </label>
                      <input
                        value={editedData[fieldKey] ?? ''}
                        onChange={e => setEditedData(d => ({ ...d, [fieldKey]: e.target.value }))}
                        className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                        placeholder={extracted[fieldKey] ? '' : 'Not detected'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── STEP: SAVING ── */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <span className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-200">Saving document…</p>
                <p className="text-xs text-slate-500 mt-1">Uploading to secure storage</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          {step === 'select' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all">
                Cancel
              </button>
              {file && (
                <button onClick={handleUploadWithoutAI}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all whitespace-nowrap">
                  Skip AI
                </button>
              )}
              <button onClick={handleAnalyze} disabled={!file}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: file ? '0 0 16px rgba(99,102,241,0.3)' : 'none' }}>
                <span>✨</span> Analyze with AI
              </button>
            </div>
          )}

          {step === 'analyzing' && (
            <button disabled
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-white/[0.03] border border-white/[0.06] cursor-not-allowed">
              Analyzing…
            </button>
          )}

          {step === 'review' && (
            <div className="flex gap-3">
              <button onClick={() => { setStep('select'); setExtracted(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all">
                ← Re-upload
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 16px rgba(16,185,129,0.25)' }}>
                ✓ Confirm & Save
              </button>
            </div>
          )}

          {step === 'saving' && (
            <button disabled
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-white/[0.03] border border-white/[0.06] cursor-not-allowed">
              Saving…
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}

// ── Main EmployeeDetail ───────────────────────────────────────
export default function EmployeeDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const isCandidate = location.pathname.startsWith('/hr/candidates/')

  const { data: candidate, isLoading: candLoading } = useCandidate(isCandidate ? id : null)
  const { data: employee,  isLoading: empLoading  } = useEmployee(!isCandidate ? id : null)

  const person    = isCandidate ? candidate : employee
  const isLoading = isCandidate ? candLoading : empLoading

  const candidateId = isCandidate ? id : employee?.candidate_id
  const { data: docs  = [], isLoading: docsLoading  } = useDocuments(candidateId)
  const { data: items = [], isLoading: checkLoading } = useChecklist(candidateId)

  const [showUpload, setShowUpload] = useState(false)

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

  // Status colours for doc row
  const statusBg = {
    verified: 'bg-emerald-500/10 border-emerald-500/20',
    uploaded: 'bg-sky-500/10 border-sky-500/20',
    pending:  'bg-slate-500/10 border-slate-500/15',
    failed:   'bg-red-500/10 border-red-500/20',
    flagged:  'bg-amber-500/10 border-amber-500/20',
  }

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

          {/* Documents header */}
          <div className="px-4 sm:px-5 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-white text-sm">Documents</h2>
              <p className="text-xs text-slate-500 mt-0.5">{verifiedDocs}/{docs.length} verified</p>
            </div>
            {/* Upload button — only show for candidates (HR can upload on their behalf) */}
            {isCandidate && candidateId && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-all"
                title="Upload & verify a document">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload
              </button>
            )}
          </div>

          {docsLoading
            ? <div className="py-8 flex justify-center"><LoadingSpinner size="sm" /></div>
            : docs.length === 0
              ? (
                <div className="py-10 px-5 text-center">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm text-slate-500 mb-3">No documents uploaded yet</p>
                  {isCandidate && candidateId && (
                    <button onClick={() => setShowUpload(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-all">
                      ✨ Upload & verify first document
                    </button>
                  )}
                </div>
              )
              : (
                <div className="divide-y divide-white/[0.04]">
                  {docs.map(doc => (
                    <div key={doc.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
                      <span className="text-lg flex-shrink-0">{doc.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">{doc.label}</p>
                        {doc.expiry_date && (
                          <p className={`text-xs mt-0.5 ${doc.days_until_expiry < 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                            Exp. {doc.expiry_date}
                            {doc.days_until_expiry < 60 && ` · ⚠️ ${doc.days_until_expiry}d`}
                          </p>
                        )}
                        {/* Extracted data preview */}
                        {doc.extracted_data && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(doc.extracted_data)
                              .filter(([k, v]) => v && !['is_authentic', 'confidence', 'flags', 'note', 'days_until_expiry'].includes(k))
                              .slice(0, 2)
                              .map(([k, v]) => (
                                <span key={k} className="text-[10px] bg-white/[0.04] border border-white/[0.07] text-slate-500 px-1.5 py-0.5 rounded-md">
                                  {FIELD_LABELS[k] || k}: <span className="text-slate-400">{String(v).slice(0, 20)}</span>
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
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

      {/* Upload modal */}
      {showUpload && candidateId && (
        <DocumentUploadModal
          candidateId={candidateId}
          existingTypes={docs.map(d => d.type)}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}