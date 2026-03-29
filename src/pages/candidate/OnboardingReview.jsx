// src/pages/candidate/OnboardingReview.jsx
// Shown when onboarding_progress = 100 (after final submit).
// Displays Profile · Terms · Documents in one consolidated read-only view
// — no more separate sidebar tabs for those sections after submission.

import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {useCandidate,useDocuments,useChecklist,useFinalSubmitOnboarding,} from '../../hooks/useData'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// ── Tiny helpers ──────────────────────────────────────────────
function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <p className="w-36 text-[11px] text-slate-600 uppercase tracking-wider shrink-0">{label}</p>
      <p className="text-sm text-slate-300 font-medium">{value}</p>
    </div>
  )
}

function SectionCard({ icon, title, children, accent = 'indigo' }) {
  const accents = {
    indigo: 'border-indigo-500/15 from-indigo-500/[0.04]',
    teal:   'border-teal-500/15   from-teal-500/[0.04]',
    cyan:   'border-cyan-500/15   from-cyan-500/[0.04]',
  }
  return (
    <div className={`rounded-2xl border bg-[#0C1A1D] overflow-hidden ${accents[accent]}`}
      style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-from) 0%, transparent 55%)` }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
        <span className="text-xl">{icon}</span>
        <h3 className="font-display font-bold text-white text-sm">{title}</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
          ✓ Submitted
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ── Final Submit Confirm Modal ────────────────────────────────
function FinalSubmitModal({ onConfirm, onCancel, submitting }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1120] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl"
        style={{ animation: 'slideUp 0.2s ease-out both' }}>
        <div className="p-6 text-center">
          <div className="text-5xl mb-3">🚀</div>
          <h2 className="font-display font-bold text-white text-lg mb-2">Submit Onboarding?</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            This will finalise your onboarding. Your{' '}
            <strong className="text-white">ID card</strong> and{' '}
            <strong className="text-white">work email details</strong> will be sent to your personal email.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200 transition-all disabled:opacity-50">
            Not yet
          </button>
          <button onClick={onConfirm} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 16px rgba(20,184,166,0.3)' }}>
            {submitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : '✅ Confirm & Submit'}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── Doc type labels (mirrors Documents.jsx) ──────────────────
const DOC_LABELS = {
  passport:          { label: 'Passport',              icon: '🛂' },
  visa:              { label: 'Visa / Work Permit',     icon: '📋' },
  degree:            { label: 'Degree Certificate',     icon: '🎓' },
  employment_letter: { label: 'Offer Letter',           icon: '📝' },
  bank_details:      { label: 'Bank Account Details',   icon: '🏦' },
  aadhaar:           { label: 'Aadhaar Card',           icon: '🪪' },
  pan_card:          { label: 'PAN Card',               icon: '💳' },
}

// ── Main component ────────────────────────────────────────────
export default function OnboardingReview() {
  const { user }           = useAuth()
  const candidateId        = user?.candidate_id
  const { data: emp, isLoading: empLoading } = useCandidate(candidateId)
  const { data: docs  = [] }                 = useDocuments(candidateId)
  const { data: items = [] }                 = useChecklist(candidateId)
  const finalSubmit                          = useFinalSubmitOnboarding()

  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [submitting,      setSubmitting]      = useState(false)

  // Whether final-submit has already been completed (ID Card Issued = ticked)
  const idCardItem    = items.find(i => i.title === 'ID Card Issued')
  const alreadyDone   = idCardItem?.completed ?? false

  // Whether checklist gates are all met
  const SUBMIT_REQUIRED = [
    'Profile Completed',
    'Contract Signed',
    'Documents Submitted',
    'Documents Verified',
    'Policy Training',
  ]
  const canSubmit = SUBMIT_REQUIRED.every(
    title => items.find(i => i.title === title)?.completed
  )

  const handleFinalSubmit = async () => {
    setSubmitting(true)
    try {
      const result = await finalSubmit.mutateAsync(candidateId)
      setSubmitModalOpen(false)
      if (result?.alreadySubmitted) {
        toast('Already submitted — your ID card was sent earlier.', { icon: 'ℹ️' })
      } else {
        toast.success(
          result?.idCardSent
            ? '🎉 Submitted! Your ID card has been emailed to you.'
            : '🎉 Submitted! HR will send your ID card shortly.',
          { duration: 8000 }
        )
      }
    } catch (err) {
      toast.error(err.message || 'Submission failed — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (empLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading your summary…" />
      </div>
    )
  }

  const formattedStart = emp?.start_date
    ? new Date(emp.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* ── Hero banner ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-teal-500/15 bg-[#0B1A1D] p-6 sm:p-8 mb-6 relative overflow-hidden animate-slide-up opacity-0"
        style={{
          animationFillMode: 'forwards',
          backgroundImage: 'linear-gradient(135deg, rgba(20,184,166,0.07) 0%, rgba(6,182,212,0.04) 50%, transparent 70%)',
        }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-indigo-500/10 border-2 border-indigo-500/20 flex-shrink-0 flex items-center justify-center">
            {emp?.profile_photo_url
              ? <img src={emp.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-indigo-300">{emp?.avatar || '?'}</span>}
          </div>

          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-2">
              {alreadyDone ? '✅ Onboarding Submitted' : '📋 Review & Submit'}
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white leading-tight">
              {emp?.full_name || user?.name || 'Your Onboarding Summary'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {emp?.position}{emp?.department ? ` · ${emp.department}` : ''}
              {formattedStart ? ` · Starts ${formattedStart}` : ''}
            </p>
          </div>
        </div>

        {/* ── Submit CTA or Already Done ─────────────────────── */}
        {!alreadyDone && canSubmit && (
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.06]">
            <div className="flex-1 text-center sm:text-left">
              <p className="font-semibold text-white text-sm">Everything looks good! 🎉</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Review your details below, then click <strong className="text-teal-400">Final Submit</strong> — your ID card will be emailed instantly.
              </p>
            </div>
            <button
              onClick={() => setSubmitModalOpen(true)}
              className="flex-shrink-0 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-all whitespace-nowrap"
              style={{ boxShadow: '0 0 20px rgba(20,184,166,0.4)' }}>
              🚀 Final Submit
            </button>
          </div>
        )}

        {!alreadyDone && !canSubmit && (
          <div className="mt-5 flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05]">
            <span className="text-xl flex-shrink-0">⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">A few steps still pending</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete all checklist items before final submission becomes available.
              </p>
            </div>
          </div>
        )}

        {alreadyDone && (
          <div className="mt-5 p-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.06]">
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 text-xs">
              {[
                { icon: '✅', label: 'Profile saved' },
                { icon: '✍️', label: 'Contract signed' },
                { icon: '📄', label: 'Docs verified' },
                { icon: '🪪', label: 'ID card issued' },
                { icon: '🎓', label: 'Training done' },
              ].map(b => (
                <span key={b.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-medium">
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 1: Profile ──────────────────────────────── */}
      <div className="space-y-4 animate-slide-up opacity-0" style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
        <SectionCard icon="👤" title="Personal Profile" accent="indigo">
          <Row label="Full Name"        value={emp?.full_name} />
          <Row label="Date of Birth"    value={emp?.date_of_birth} />
          <Row label="Phone"            value={emp?.phone} />
          <Row label="Address"          value={emp?.address} />
          <Row label="Emergency Contact" value={
            emp?.emergency_contact_name
              ? `${emp.emergency_contact_name}${emp.emergency_contact_phone ? '  ·  ' + emp.emergency_contact_phone : ''}`
              : null
          } />
          <Row label="Position"         value={emp?.position} />
          <Row label="Department"       value={emp?.department} />
          <Row label="Manager"          value={emp?.manager} />
          <Row label="Location"         value={emp?.location} />
          <Row label="Work Email"       value={emp?.work_email} />
          <Row label="Start Date"       value={formattedStart} />
        </SectionCard>

        {/* ── Section 2: Contract / Terms ─────────────────── */}
        <SectionCard icon="📋" title="Terms & Contract" accent="teal">
          {emp?.terms_accepted ? (
            <div className="space-y-1.5">
              <Row label="Contract Status" value="Signed digitally ✓" />
              {emp.terms_accepted_at && (
                <Row label="Signed On" value={
                  new Date(emp.terms_accepted_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                } />
              )}
              <Row label="Signature"      value={emp.full_name} />
            </div>
          ) : (
            <p className="text-sm text-amber-400">⚠ Terms not yet accepted</p>
          )}
        </SectionCard>

        {/* ── Section 3: Documents ────────────────────────── */}
        <SectionCard icon="📄" title="Uploaded Documents" accent="cyan">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {docs.map(doc => {
                const meta = DOC_LABELS[doc.type] || { label: doc.type, icon: '📄' }
                const isVerified = doc.status === 'verified'
                return (
                  <div key={doc.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-base mt-0.5 flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-200">{meta.label}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                          isVerified
                            ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                            : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                        }`}>
                          {isVerified ? '✓ Verified' : '⟳ Pending Review'}
                        </span>
                      </div>
                      {/* Key extracted fields */}
                      {doc.extracted_data && (() => {
                        const d = doc.extracted_data
                        const pairs = [
                          d.name            && ['Name',           d.name],
                          d.passport_number && ['Passport No.',   d.passport_number],
                          d.pan_number      && ['PAN',            d.pan_number],
                          d.aadhaar_number  && ['Aadhaar',        d.aadhaar_number],
                          d.account_number  && ['Account No.',    d.account_number],
                          d.bank_name       && ['Bank',           d.bank_name],
                          d.institution     && ['Institution',    d.institution],
                          d.expiry_date     && ['Expiry',         d.expiry_date],
                        ].filter(Boolean).slice(0, 4)
                        if (!pairs.length) return null
                        return (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                            {pairs.map(([lbl, val]) => (
                              <div key={lbl} className="flex gap-1.5 items-baseline">
                                <span className="text-[10px] text-slate-600 shrink-0">{lbl}:</span>
                                <span className="text-[11px] text-slate-400 truncate">{String(val).slice(0, 24)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    {doc.download_url && (
                      <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-[10px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors mt-0.5">
                        View
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Bottom submit button (repeat for convenience) ──── */}
      {!alreadyDone && canSubmit && (
        <div className="mt-6 animate-slide-up opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <button
            onClick={() => setSubmitModalOpen(true)}
            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-2xl transition-all"
            style={{ boxShadow: '0 0 24px rgba(20,184,166,0.3)' }}>
            🚀 Final Submit — Complete Onboarding
          </button>
        </div>
      )}

      {alreadyDone && (
        <p className="text-center text-xs text-slate-600 mt-6 pb-4">
          Onboarding finalised · HR has been notified · Check your inbox for your ID card
        </p>
      )}

      {submitModalOpen && (
        <FinalSubmitModal
          onConfirm={handleFinalSubmit}
          onCancel={() => setSubmitModalOpen(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}