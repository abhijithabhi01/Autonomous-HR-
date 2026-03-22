import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/shared/StatusBadge'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { useDocuments, useUploadDocument, useCompleteChecklistByTitle } from '../../hooks/useData'

// ── Document type config ──────────────────────────────────────
const DOC_TYPES = [
  {
    type: 'passport', label: 'Passport', icon: '🛂', required: true,
    fields: [
      { key: 'name',            label: 'Full Name' },
      { key: 'passport_number', label: 'Passport Number' },
      { key: 'nationality',     label: 'Nationality' },
      { key: 'date_of_birth',   label: 'Date of Birth' },
      { key: 'expiry_date',     label: 'Expiry Date' },
    ],
  },
  {
    type: 'visa', label: 'Visa / Work Permit', icon: '📋', required: true,
    fields: [
      { key: 'visa_type',             label: 'Visa Type' },
      { key: 'holder_name',           label: 'Holder Name' },
      { key: 'country',               label: 'Country' },
      { key: 'expiry_date',           label: 'Expiry Date' },
      { key: 'permitted_activities',  label: 'Permitted Activities' },
    ],
  },
  {
    type: 'degree', label: 'Degree Certificate', icon: '🎓', required: true,
    fields: [
      { key: 'student_name',    label: 'Student Name' },
      { key: 'institution',     label: 'Institution' },
      { key: 'degree',          label: 'Degree' },
      { key: 'field_of_study',  label: 'Field of Study' },
      { key: 'graduation_year', label: 'Graduation Year' },
    ],
  },
  {
    type: 'employment_letter', label: 'Employment Letter', icon: '📄', required: true,
    fields: [
      { key: 'employee_name', label: 'Employee Name' },
      { key: 'company',       label: 'Company' },
      { key: 'position',      label: 'Position' },
      { key: 'start_date',    label: 'Start Date' },
      { key: 'end_date',      label: 'End Date' },
    ],
  },
  {
    type: 'bank_details', label: 'Bank Account Details', icon: '🏦', required: false,
    fields: [
      { key: 'account_holder',  label: 'Account Holder' },
      { key: 'bank_name',       label: 'Bank Name' },
      { key: 'account_type',    label: 'Account Type' },
      { key: 'account_number',  label: 'Account Number' },
      { key: 'ifsc_code',       label: 'IFSC Code' },
    ],
  },
  {
    type: 'aadhaar', label: 'Aadhaar Card', icon: '🪪', required: false,
    fields: [
      { key: 'name',          label: 'Full Name' },
      { key: 'aadhaar_number',label: 'Aadhaar Number' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'gender',        label: 'Gender' },
      { key: 'address',       label: 'Address' },
    ],
  },
  {
    type: 'pan_card', label: 'PAN Card', icon: '💳', required: false,
    fields: [
      { key: 'name',        label: 'Name' },
      { key: 'pan_number',  label: 'PAN Number' },
      { key: 'father_name', label: "Father's Name" },
      { key: 'date_of_birth', label: 'Date of Birth' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = e => resolve(e.target.result.split(',')[1])
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsDataURL(file)
  })
}

// Calls backend /api/documents/verify — uses Document AI or Gemini server-side
async function verifyViaBackend(base64, mimeType, documentType) {
  const base     = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
  const endpoint = base ? `${base}/api/documents/verify` : '/api/documents/verify'
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ base64, mimeType, documentType }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Verification failed (${res.status})`)
  }
  return res.json()
}

function ConfidencePill({ value }) {
  if (!value) return null
  const cls = value >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : value >= 65 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            :               'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {value}% confidence
    </span>
  )
}

// ── Per-document card with inline review step ─────────────────
// States: idle | analyzing | review | saving | done
function DocCard({ docType, candidateId, existingDoc, uploadMutation, index }) {
  const [phase,       setPhase]       = useState('idle')   // idle | analyzing | review | saving
  const [pendingFile, setPendingFile] = useState(null)
  const [extracted,   setExtracted]   = useState(null)
  const [editedData,  setEditedData]  = useState({})
  const [preview,     setPreview]     = useState(null)

  const status     = existingDoc?.status || 'pending'
  const isVerified = status === 'verified'
  const isUploaded = status === 'uploaded'

  // ── Drop handler ──────────────────────────────────────────
  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return

    setPendingFile(file)
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    setPhase('analyzing')

    try {
      const base64 = await readFileAsBase64(file)
      const result = await verifyViaBackend(base64, file.type, docType.type)
      setExtracted(result)
      // Seed editable fields from AI result (may be empty if PDF or AI failed)
      const init = {}
      docType.fields.forEach(f => { init[f.key] = result[f.key] ?? '' })
      setEditedData(init)
      setPhase('review')
    } catch (err) {
      console.warn('[DocCard] AI failed:', err.message)
      setExtracted(null)
      setEditedData({})
      setPhase('review')
    }
  }, [docType, candidateId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { 'image/*': [], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    disabled: phase === 'analyzing' || phase === 'saving',
  })

  // ── Retry OCR ────────────────────────────────────────────
  const handleRetryOCR = async () => {
    if (!pendingFile) return
    setPhase('analyzing')
    try {
      const base64 = await readFileAsBase64(pendingFile)
      const result = await verifyViaBackend(base64, pendingFile.type, docType.type)
      setExtracted(result)
      const init = {}
      docType.fields.forEach(f => { init[f.key] = result[f.key] ?? '' })
      setEditedData(init)
      setPhase('review')
    } catch (err) {
      setExtracted({ note: err.message, is_authentic: null, confidence: 0, flags: [] })
      setPhase('review')
    }
  }

  // ── Confirm & save ────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pendingFile) return
    setPhase('saving')
    try {
      const finalData = extracted ? { ...extracted, ...editedData } : null
      await uploadMutation.mutateAsync({
        candidateId,
        docType: docType.type,
        file:    pendingFile,
        extractedData: finalData,
      })
      setPhase('idle')
      setPendingFile(null)
      setExtracted(null)
      setPreview(null)
    } catch (err) {
      toast.error(err.message || 'Upload failed')
      setPhase('review')
    }
  }

  // ── Cancel review ─────────────────────────────────────────
  const handleCancel = () => {
    setPendingFile(null)
    setExtracted(null)
    setEditedData({})
    setPreview(null)
    setPhase('idle')
  }

  // ── Replace (reset to idle) ───────────────────────────────
  const handleReplace = () => {
    setPendingFile(null)
    setExtracted(null)
    setEditedData({})
    setPreview(null)
    setPhase('idle')
  }

  // ── Border / bg based on state ────────────────────────────
  const cardBorder =
    phase === 'review'   ? 'border-indigo-500/25'  :
    isVerified           ? 'border-teal-500/20'    :
    isDragActive         ? 'border-teal-500/50'    :
    isUploaded           ? 'border-sky-500/15'     :
                          'border-white/[0.05]'

  const cardBg =
    phase === 'review'   ? 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 55%)'  :
    isVerified           ? 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)'  :
                          'none'

  return (
    <div
      className={`rounded-2xl border bg-[#0C1A1D] overflow-hidden transition-all duration-300 animate-slide-up opacity-0`}
      style={{
        borderColor: undefined,  // handled by tailwind class above
        backgroundImage: cardBg,
        animationDelay: `${index * 70}ms`,
        animationFillMode: 'forwards',
        // Use inline styles for dynamic border since Tailwind can't do runtime colors cleanly
        outline: phase === 'review' ? '1px solid rgba(99,102,241,0.25)'
               : isVerified         ? '1px solid rgba(20,184,166,0.2)'
               : isDragActive       ? '1px solid rgba(20,184,166,0.5)'
               : isUploaded         ? '1px solid rgba(14,165,233,0.15)'
               :                      '1px solid rgba(255,255,255,0.05)',
        outlineOffset: '-1px',
      }}>

      {/* ── Card header ── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
            {docType.icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-200 text-sm">{docType.label}</p>
              {docType.required && (
                <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded-full">Required</span>
              )}
            </div>
            {/* Expiry info on existing verified doc */}
            {existingDoc?.expiry_date && (
              <p className={`text-xs mt-0.5 ${existingDoc.days_until_expiry < 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                {existingDoc.days_until_expiry < 60
                  ? `⚠️ Expires in ${existingDoc.days_until_expiry} days`
                  : `Valid until ${existingDoc.expiry_date}`}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={phase === 'review' ? 'uploaded' : status} />
      </div>

      <div className="p-4 sm:p-5">

        {/* ── PHASE: analyzing ── */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-indigo-300">AI is reading your document…</p>
              <p className="text-xs text-slate-500 mt-0.5">Extracting fields and checking authenticity</p>
            </div>
          </div>
        )}

        {/* ── PHASE: saving ── */}
        {phase === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-teal-300">Uploading securely…</p>
          </div>
        )}

        {/* ── PHASE: review ── */}
        {phase === 'review' && (
          <div className="space-y-4">
            {/* File preview */}
            {preview && (
              <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                <img src={preview} alt="Document preview"
                  className="w-full max-h-36 object-contain bg-black/20" />
              </div>
            )}
            {!preview && pendingFile && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-sm font-medium text-slate-200 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-slate-500">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            )}

            {/* AI verdict */}
            {extracted ? (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                ${extracted.is_authentic !== false
                  ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                  : 'bg-red-500/[0.06] border-red-500/20'}`}>
                <span className="text-xl flex-shrink-0">
                  {extracted.is_authentic !== false ? '✅' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${extracted.is_authentic !== false ? 'text-emerald-300' : 'text-red-300'}`}>
                      {extracted.is_authentic !== false ? 'Document looks authentic' : 'Authenticity concern detected'}
                    </p>
                    <ConfidencePill value={extracted.confidence} />
                  </div>
                  {extracted.flags?.length > 0 && (
                    <p className="text-xs text-amber-400 mt-0.5">⚠️ {extracted.flags.join(' · ')}</p>
                  )}
                  {extracted.note && (
                    <p className="text-xs text-slate-500 mt-0.5">{extracted.note}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-300">AI analysis unavailable</p>
                  <p className="text-xs text-slate-500 mt-0.5">Document will be saved for manual HR review</p>
                </div>
              </div>
            )}

            {/* Extracted fields — editable */}
            {/* Always show review fields in review phase — extracted may be null for PDFs */}
            {(phase === 'review' || phase === 'saving') && (
              <div>
                {/* AI failure / PDF note with retry */}
                {extracted?.note && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-3">
                    <span className="text-amber-400 text-sm flex-shrink-0 mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="text-xs text-amber-300/80 leading-relaxed">{extracted.note}</p>
                      {pendingFile && !pendingFile.type.includes('pdf') && (
                        <button onClick={handleRetryOCR}
                          className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline transition-colors">
                          Retry AI extraction ↺
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Review extracted data <span className="font-normal normal-case text-slate-600">· correct any errors before saving</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docType.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                        {f.label}
                      </label>
                      <input
                        value={editedData[f.key] ?? ''}
                        onChange={e => setEditedData(d => ({ ...d, [f.key]: e.target.value }))}
                        className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                        placeholder={extracted[f.key] ? '' : 'Not detected'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 14px rgba(20,184,166,0.25)' }}>
                <span>✓</span> Confirm & Save
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: idle — show verified data OR dropzone ── */}
        {phase === 'idle' && (
          <>
            {/* Verified: show extracted summary */}
            {isVerified && existingDoc?.extracted_data && (
              <div className="bg-teal-500/[0.04] border border-teal-500/10 rounded-xl p-3.5 mb-3">
                <p className="text-xs font-semibold text-teal-400 mb-2.5">✓ AI Verified — Extracted Data</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {docType.fields
                    .filter(f => existingDoc.extracted_data[f.key])
                    .slice(0, 6)
                    .map(f => (
                      <div key={f.key}>
                        <p className="text-[10px] text-slate-600">{f.label}</p>
                        <p className="text-xs text-slate-300 font-medium truncate">
                          {String(existingDoc.extracted_data[f.key]).slice(0, 28)}
                        </p>
                      </div>
                    ))}
                </div>
                {existingDoc.extracted_data.confidence > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-teal-500/10 flex items-center gap-2">
                    <ConfidencePill value={existingDoc.extracted_data.confidence} />
                    {existingDoc.extracted_data.is_authentic !== false && (
                      <span className="text-[10px] text-teal-500">Authenticity confirmed</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Uploaded (no AI data) — show placeholder */}
            {isUploaded && !existingDoc?.extracted_data && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/[0.05] border border-sky-500/15 mb-3">
                <span className="text-lg">📤</span>
                <div>
                  <p className="text-sm font-semibold text-sky-300">Uploaded — pending HR review</p>
                  <p className="text-xs text-slate-500 mt-0.5">HR will manually verify this document</p>
                </div>
              </div>
            )}

            {/* Dropzone — shown when not verified, or for replace */}
            <div {...getRootProps()}
              className={`border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
                ${isDragActive
                  ? 'border-teal-500 bg-teal-500/5'
                  : isVerified
                    ? 'border-white/[0.05] hover:border-white/[0.10]'
                    : 'border-white/[0.08] hover:border-teal-500/30 hover:bg-teal-500/[0.02]'}`}>
              <input {...getInputProps()} />
              <div className={`flex flex-col items-center text-center ${isVerified ? 'py-3' : 'py-6 sm:py-7'}`}>
                {isVerified ? (
                  <p className="text-xs text-slate-600 hover:text-teal-400 transition-colors">
                    Replace document ↑
                  </p>
                ) : (
                  <>
                    <div className={`mb-3 w-10 h-10 rounded-xl flex items-center justify-center border
                      ${isDragActive ? 'bg-teal-500/10 border-teal-500/30' : 'bg-white/[0.03] border-white/[0.07]'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDragActive ? '#2dd4bf' : '#475569'} strokeWidth="1.8">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-300">
                      {isDragActive ? 'Drop it here!' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">PDF, JPG, PNG, WebP · max 10 MB</p>
                    <p className="text-[11px] text-indigo-400/70 mt-1.5 font-medium">✨ AI will extract and verify automatically</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Documents page ───────────────────────────────────────
export default function Documents() {
  const { user }        = useAuth()
  const candidateId     = user?.candidate_id
  const { data: docs = [], isLoading } = useDocuments(candidateId)
  const uploadMutation   = useUploadDocument()
  const completeByTitle  = useCompleteChecklistByTitle()

  // docsMap must be declared first — used by allRequired checks below
  const docsMap  = docs.reduce((acc, d) => ({ ...acc, [d.type]: d }), {})
  const verified = docs.filter(d => d.status === 'verified').length
  const total    = DOC_TYPES.length
  const pct      = Math.round((verified / total) * 100)

  // Auto-complete checklist items when upload thresholds are crossed
  const requiredTypes       = DOC_TYPES.filter(d => d.required).map(d => d.type)
  const allRequiredUploaded = requiredTypes.every(t => !!docsMap[t])
  const allRequiredVerified = requiredTypes.every(t => docsMap[t]?.status === 'verified')

  // Auto-tick checklist once thresholds are crossed (idempotent)
  const prevUploaded = useRef(false)
  const prevVerified  = useRef(false)
  useEffect(() => {
    if (!candidateId) return
    if (allRequiredUploaded && !prevUploaded.current) {
      prevUploaded.current = true
      completeByTitle.mutate({ candidateId, title: 'Documents Submitted', description: 'All required documents uploaded', category: 'documents', sort_order: 2 })
    }
    if (allRequiredVerified && !prevVerified.current) {
      prevVerified.current = true
      completeByTitle.mutate({ candidateId, title: 'Documents Verified', description: 'AI verification of all documents', category: 'documents', sort_order: 3 })
    }
  }, [allRequiredUploaded, allRequiredVerified, candidateId])

  if (!candidateId) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 text-center">
        <div>
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-slate-300 font-semibold mb-1">No candidate record linked</p>
          <p className="text-slate-500 text-sm">Please contact HR — your account isn't linked to an onboarding record yet.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading documents…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Documents</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload each document — AI will extract and verify the data for you
        </p>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-4 sm:p-5 mb-6 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-300">Verification Progress</p>
            <p className="text-xs text-slate-500 mt-0.5">{verified} of {total} documents verified</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-display font-bold text-white leading-none">{pct}<span className="text-slate-500 text-base font-normal">%</span></p>
          </div>
        </div>
        <div className="w-full bg-white/[0.04] rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${pct}%` }} />
        </div>
        {verified === total && (
          <div className="mt-3 px-4 py-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center gap-2">
            <span>🎉</span>
            <p className="text-teal-400 font-semibold text-sm">All documents verified! HR has been notified.</p>
          </div>
        )}
      </div>

      {/* How it works — show only when nothing uploaded yet */}
      {verified === 0 && docs.length === 0 && (
        <div className="flex items-start gap-3 sm:gap-4 mb-6 px-4 py-3.5 rounded-xl bg-indigo-500/[0.05] border border-indigo-500/15 animate-fade-in">
          <span className="text-xl flex-shrink-0 mt-0.5">✨</span>
          <div>
            <p className="text-sm font-semibold text-indigo-300">AI-powered verification</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Upload any document — our AI reads it, extracts the key fields, and checks authenticity.
              You can review and correct anything before saving.
            </p>
          </div>
        </div>
      )}

      {/* Doc cards */}
      <div className="space-y-4">
        {DOC_TYPES.map((docType, i) => (
          <DocCard
            key={docType.type}
            docType={docType}
            candidateId={candidateId}
            existingDoc={docsMap[docType.type]}
            uploadMutation={uploadMutation}
            index={i}
          />
        ))}
      </div>

      {/* Bottom note */}
      <p className="text-center text-xs text-slate-600 mt-8 pb-4">
        All documents are encrypted and stored securely · Only HR can view them
      </p>
    </div>
  )
}