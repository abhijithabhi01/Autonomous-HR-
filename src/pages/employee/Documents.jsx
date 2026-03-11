import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/shared/StatusBadge'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { useDocuments, useUploadDocument } from '../../hooks/useData'
import { verifyDocument } from '../../lib/ai'

const DOC_TYPES = [
  { type: 'passport',          label: 'Passport',             icon: '🛂', required: true },
  { type: 'visa',              label: 'Visa / Work Permit',   icon: '📋', required: true },
  { type: 'degree',            label: 'Degree Certificate',   icon: '🎓', required: true },
  { type: 'employment_letter', label: 'Employment Letter',    icon: '📄', required: true },
  { type: 'bank_details',      label: 'Bank Account Details', icon: '🏦', required: false },
]

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = (e) => resolve(e.target.result.split(',')[1])
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsDataURL(file)
  })
}

function DropZone({ docType, candidateId, existingDoc, uploadMutation }) {
  const [verifying, setVerifying] = useState(false)

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    setVerifying(true)
    const toastId = toast.loading(`Verifying ${docType.label} with AI…`)
    try {
      const base64 = await readFileAsBase64(file)
      let extractedData = null
      try {
        extractedData = await verifyDocument(base64, file.type, docType.type)
      } catch {
        toast.error('AI unavailable — saved for manual review', { id: toastId })
      }
      await uploadMutation.mutateAsync({ candidateId, docType: docType.type, file, extractedData })
      if (extractedData) toast.success(`${docType.label} verified!`, { id: toastId })
    } catch (err) {
      toast.error(err.message || 'Upload failed', { id: toastId })
    } finally {
      setVerifying(false)
    }
  }, [docType, candidateId, uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1,
    accept: { 'image/*': [], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
  })

  const status      = existingDoc?.status || 'pending'
  const isVerified  = status === 'verified'
  const extracted   = existingDoc?.extracted_data
  const daysUntil   = existingDoc?.days_until_expiry
  const expiryDate  = existingDoc?.expiry_date

  return (
    <div className="rounded-2xl border bg-[#0C1A1D] overflow-hidden transition-all duration-200"
      style={{
        borderColor: isVerified ? 'rgba(20,184,166,0.2)' : isDragActive ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.05)',
        backgroundImage: isVerified ? 'linear-gradient(135deg, rgba(20,184,166,0.03) 0%, transparent 55%)' : 'none',
      }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xl flex-shrink-0">
              {docType.icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-200 text-sm">{docType.label}</p>
                {docType.required && (
                  <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded-full">Required</span>
                )}
              </div>
              {expiryDate && (
                <p className={`text-xs mt-0.5 ${daysUntil < 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {daysUntil < 60 ? `⚠️ Expires in ${daysUntil} days` : `Valid until ${expiryDate}`}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* AI extracted data */}
        {extracted && isVerified && (
          <div className="bg-teal-500/5 border border-teal-500/10 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-teal-400 mb-2">✓ AI Verified</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(extracted)
                .filter(([k]) => !['flags', 'is_authentic', 'note'].includes(k))
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-slate-600 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-300 font-medium truncate">{String(v)}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Dropzone */}
        {!isVerified && (
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-teal-500 bg-teal-500/5' : 'border-white/[0.08] hover:border-teal-500/30 hover:bg-teal-500/[0.02]'}`}>
            <input {...getInputProps()} />
            {verifying || uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                <p className="text-sm text-teal-400 font-medium">
                  {verifying ? 'AI verifying document…' : 'Uploading…'}
                </p>
                <p className="text-xs text-slate-500">This may take a few seconds</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">{status === 'uploaded' ? '📤' : '📁'}</p>
                <p className="text-sm font-medium text-slate-300">
                  {isDragActive ? 'Drop it here!' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-slate-600 mt-1">PDF, JPG, PNG up to 10 MB</p>
              </div>
            )}
          </div>
        )}

        {isVerified && (
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <button className="w-full py-2 text-xs text-slate-600 hover:text-teal-400 transition-colors">
              Replace document ↑
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Documents() {
  const { user } = useAuth()
  const candidateId = user?.candidate_id
  const { data: docs = [], isLoading } = useDocuments(candidateId)
  const uploadMutation = useUploadDocument()
  const docsMap  = docs.reduce((acc, d) => ({ ...acc, [d.type]: d }), {})
  const verified = docs.filter(d => d.status === 'verified').length
  const total    = DOC_TYPES.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading documents…" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Documents</h1>
        <p className="text-slate-500 text-sm mt-1">Upload and AI-verify your onboarding documents</p>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-4 sm:p-5 mb-6 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, transparent 55%)' }}>
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-slate-300">Verification Progress</p>
          <p className="text-sm font-bold text-white">{verified}/{total} verified</p>
        </div>
        <div className="w-full bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${(verified / total) * 100}%` }} />
        </div>
        {verified === total && (
          <p className="text-xs text-teal-400 mt-2.5 font-medium">🎉 All documents verified! HR has been notified.</p>
        )}
      </div>

      <div className="space-y-4">
        {DOC_TYPES.map((docType, i) => (
          <div key={docType.type} className="animate-slide-up opacity-0"
            style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'forwards' }}>
            <DropZone
              docType={docType}
              candidateId={candidateId}
              existingDoc={docsMap[docType.type]}
              uploadMutation={uploadMutation}
            />
          </div>
        ))}
      </div>
    </div>
  )
}