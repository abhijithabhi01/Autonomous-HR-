import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
  // import { useCompleteChecklistByTitle } from '../../hooks/useData'
import toast from 'react-hot-toast'

export default function TermsAndConditions() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const completeByTitle = useCompleteChecklistByTitle()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [termsData, setTermsData] = useState(null)
  const [signature, setSignature] = useState('')

  // Load existing terms acceptance status
  useEffect(() => {
    const loadTermsStatus = async () => {
      if (!user?.candidate_id && !user?.employee_id) {
        setLoadingTerms(false)
        return
      }

      const candidateId = user.candidate_id || user.employee_id
      
      try {
        const snap = await getDoc(doc(db, 'candidates', candidateId))
        if (!snap.exists()) { setLoadingTerms(false); return }
        const data = snap.data()
        setTermsData(data)
        setAccepted(data.terms_accepted || false)
        if (data.full_name) setSignature(data.full_name)
      } catch (err) {
        console.error('Failed to load terms status:', err)
      } finally {
        setLoadingTerms(false)
      }
    }

    loadTermsStatus()
  }, [user])

  const handleAccept = async () => {
    if (!accepted) {
      toast.error('Please accept the terms and conditions to continue')
      return
    }

    if (!signature.trim()) {
      toast.error('Please enter your full name as your digital signature')
      return
    }

    setLoading(true)
    try {
      const candidateId = user?.candidate_id || user?.employee_id
      await updateDoc(doc(db, 'candidates', candidateId), {
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      })
      toast.success('Terms accepted! Contract signed digitally.')
      completeByTitle.mutate({ candidateId, title: 'Contract Signed', description: 'Employment contract digitally signed', category: 'legal', sort_order: 1 })
      navigate('/onboarding/documents')
    } catch (err) {
      console.error('Terms acceptance error:', err)
      toast.error('Failed to save acceptance')
    } finally {
      setLoading(false)
    }
  }

  if (loadingTerms) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading terms...</p>
        </div>
      </div>
    )
  }

  // If already accepted, show acceptance confirmation
  if (termsData?.terms_accepted) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-white">Terms & Conditions</h1>
          <p className="text-slate-500 text-sm mt-1">Contract Status</p>
        </div>

        {/* Acceptance Confirmation */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 mb-6 animate-slide-up opacity-0 text-center"
          style={{ animationFillMode: 'forwards' }}>
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-emerald-400 mb-2">Contract Accepted</h2>
          <p className="text-slate-400 text-sm mb-4">
            You have already accepted the terms and conditions.
          </p>
          <div className="inline-block bg-white/[0.03] border border-white/[0.06] rounded-xl px-6 py-3">
            <p className="text-xs text-slate-500 mb-1">Digitally Signed On</p>
            <p className="text-white font-semibold">
              {new Date(termsData.terms_accepted_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* View Terms (Collapsed) */}
        <details className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] mb-6">
          <summary className="px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
            <span className="font-display font-semibold text-white">View Terms & Conditions</span>
          </summary>
          <div className="px-6 pb-6 max-h-96 overflow-y-auto space-y-4 text-slate-300 text-sm">
            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">1. Employment Agreement</h2>
              <p className="text-slate-400 leading-relaxed">
                By accepting these terms, you acknowledge that you have received and understood your employment offer letter, 
                including your position, compensation, benefits, and start date. You agree to abide by all company policies, 
                procedures, and code of conduct as outlined in the employee handbook.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">2. Confidentiality & Non-Disclosure</h2>
              <p className="text-slate-400 leading-relaxed">
                You agree to maintain strict confidentiality of all proprietary information, trade secrets, client data, 
                and business strategies. This obligation continues even after your employment ends. Unauthorized disclosure 
                may result in legal action and termination.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">3. Background Verification</h2>
              <p className="text-slate-400 leading-relaxed">
                You authorize D Company to conduct background checks, verify your educational credentials, employment history, 
                and professional references. You certify that all information provided during the application process is accurate 
                and complete. Any misrepresentation may result in offer withdrawal or termination.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">4. Document Verification</h2>
              <p className="text-slate-400 leading-relaxed">
                You agree to provide authentic documents for identity verification, work authorization, educational qualifications, 
                and any other required documentation. D Company reserves the right to verify all submitted documents through 
                appropriate channels and third-party verification services.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">5. At-Will Employment</h2>
              <p className="text-slate-400 leading-relaxed">
                Your employment with D Company is "at-will," meaning either you or the company may terminate the employment 
                relationship at any time, with or without cause or notice, subject to applicable laws and regulations.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">6. Code of Conduct</h2>
              <p className="text-slate-400 leading-relaxed">
                You agree to conduct yourself professionally, treat all colleagues with respect, maintain a safe workplace, 
                and comply with all applicable laws and regulations. Harassment, discrimination, or misconduct will not be tolerated.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">7. Intellectual Property</h2>
              <p className="text-slate-400 leading-relaxed">
                Any work product, inventions, or intellectual property created during your employment belongs to D Company. 
                You agree to assign all rights to such work to the company.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">8. Data Privacy</h2>
              <p className="text-slate-400 leading-relaxed">
                You consent to the collection, processing, and storage of your personal data for employment purposes, 
                including payroll, benefits administration, and compliance with legal requirements. Your data will be 
                handled in accordance with applicable privacy laws.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">9. Onboarding Compliance</h2>
              <p className="text-slate-400 leading-relaxed">
                You agree to complete all required onboarding tasks, including document uploads, training modules, 
                and compliance certifications before your start date. Failure to complete onboarding may delay your start date.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-white text-base mb-2">10. Amendments</h2>
              <p className="text-slate-400 leading-relaxed">
                D Company reserves the right to modify these terms at any time. You will be notified of any material changes 
                and may be required to re-accept updated terms.
              </p>
            </section>
          </div>
        </details>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/onboarding/profile')}
            className="px-6 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
            ← Back
          </button>

          <button
            onClick={() => navigate('/onboarding/documents')}
            className="px-8 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2"
            style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
            Continue to Documents →
          </button>
        </div>
      </div>
    )
  }

  // Show terms acceptance form
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-white">Employment Contract & Terms</h1>
        <p className="text-slate-500 text-sm mt-1">Please review and digitally sign to continue</p>
      </div>

      {/* Terms Content */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 mb-6 animate-slide-up opacity-0"
        style={{ animationFillMode: 'forwards' }}>
        
        <div className="max-h-96 overflow-y-auto pr-4 space-y-4 text-slate-300 text-sm">
          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">1. Employment Agreement</h2>
            <p className="text-slate-400 leading-relaxed">
              By accepting these terms, you acknowledge that you have received and understood your employment offer letter, 
              including your position, compensation, benefits, and start date. You agree to abide by all company policies, 
              procedures, and code of conduct as outlined in the employee handbook.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">2. Confidentiality & Non-Disclosure</h2>
            <p className="text-slate-400 leading-relaxed">
              You agree to maintain strict confidentiality of all proprietary information, trade secrets, client data, 
              and business strategies. This obligation continues even after your employment ends. Unauthorized disclosure 
              may result in legal action and termination.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">3. Background Verification</h2>
            <p className="text-slate-400 leading-relaxed">
              You authorize D Company to conduct background checks, verify your educational credentials, employment history, 
              and professional references. You certify that all information provided during the application process is accurate 
              and complete. Any misrepresentation may result in offer withdrawal or termination.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">4. Document Verification</h2>
            <p className="text-slate-400 leading-relaxed">
              You agree to provide authentic documents for identity verification, work authorization, educational qualifications, 
              and any other required documentation. D Company reserves the right to verify all submitted documents through 
              appropriate channels and third-party verification services.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">5. At-Will Employment</h2>
            <p className="text-slate-400 leading-relaxed">
              Your employment with D Company is "at-will," meaning either you or the company may terminate the employment 
              relationship at any time, with or without cause or notice, subject to applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">6. Code of Conduct</h2>
            <p className="text-slate-400 leading-relaxed">
              You agree to conduct yourself professionally, treat all colleagues with respect, maintain a safe workplace, 
              and comply with all applicable laws and regulations. Harassment, discrimination, or misconduct will not be tolerated.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">7. Intellectual Property</h2>
            <p className="text-slate-400 leading-relaxed">
              Any work product, inventions, or intellectual property created during your employment belongs to D Company. 
              You agree to assign all rights to such work to the company.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">8. Data Privacy</h2>
            <p className="text-slate-400 leading-relaxed">
              You consent to the collection, processing, and storage of your personal data for employment purposes, 
              including payroll, benefits administration, and compliance with legal requirements. Your data will be 
              handled in accordance with applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">9. Onboarding Compliance</h2>
            <p className="text-slate-400 leading-relaxed">
              You agree to complete all required onboarding tasks, including document uploads, training modules, 
              and compliance certifications before your start date. Failure to complete onboarding may delay your start date.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-white text-base mb-2">10. Amendments</h2>
            <p className="text-slate-400 leading-relaxed">
              D Company reserves the right to modify these terms at any time. You will be notified of any material changes 
              and may be required to re-accept updated terms.
            </p>
          </section>
        </div>
      </div>

      {/* Digital Signature */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 mb-6 animate-slide-up opacity-0"
        style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
        <h2 className="font-display font-semibold text-white text-sm mb-4">Digital Signature</h2>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Type your full name to sign electronically *
          </label>
          <input
            type="text"
            value={signature}
            onChange={e => setSignature(e.target.value)}
            placeholder="Enter your full name"
            className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-3 text-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all font-signature"
            style={{ fontFamily: 'Brush Script MT, cursive' }}
          />
          <p className="text-xs text-slate-500 mt-2">
            ✍️ This will serve as your legally binding electronic signature
          </p>
        </div>
      </div>

      {/* Acceptance Checkbox */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 mb-6 animate-slide-up opacity-0"
        style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-white/20 bg-transparent checked:bg-indigo-600 checked:border-indigo-600 cursor-pointer transition-all"
            />
            {accepted && (
              <svg className="absolute w-3 h-3 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
              I have read, understood, and agree to the above <span className="font-semibold">Employment Contract and Terms & Conditions</span>. 
              I certify that all information I have provided is accurate and complete. I understand that any 
              misrepresentation may result in termination of employment.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              By checking this box and signing above, you are providing your legally binding electronic signature.
            </p>
          </div>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center animate-slide-up opacity-0"
        style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
        <button
          onClick={() => navigate('/onboarding/profile')}
          disabled={loading}
          className="px-6 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
          ← Back
        </button>

        <button
          onClick={handleAccept}
          disabled={!accepted || !signature.trim() || loading}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ boxShadow: (accepted && signature.trim()) ? '0 0 16px rgba(99,102,241,0.3)' : 'none' }}>
          {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {(accepted && signature.trim()) ? '✍️ Sign & Continue' : 'Please Sign & Accept'}
          {(accepted && signature.trim()) && ' →'}
        </button>
      </div>

      {/* Legal Disclaimer */}
      <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 animate-slide-up opacity-0"
        style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
        <div className="flex gap-3">
          <span className="text-amber-400 text-xl flex-shrink-0">⚖️</span>
          <div>
            <p className="text-sm text-amber-200/90 font-semibold mb-1">Legal Notice</p>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              This electronic signature has the same legal effect as a handwritten signature. If you have any questions or concerns, 
              please contact <a href="mailto:hr@dcompany.com" className="text-amber-400 hover:underline">hr@dcompany.com</a> before signing.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}