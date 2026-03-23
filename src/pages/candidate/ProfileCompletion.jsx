import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCompleteChecklistByTitle } from '../../hooks/useData'   // ← was commented out
import toast from 'react-hot-toast'

// Firebase imports that were missing
import { db } from '../../lib/firebase'
import {
  doc, getDoc, getDocs, collection,
  query, where, updateDoc
} from 'firebase/firestore'

export default function ProfileCompletion() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const completeByTitle = useCompleteChecklistByTitle()
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    date_of_birth: '',
    profile_photo_url: null,
  })

  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => {
    console.log('User context:', user)
    if (user && !user?.candidate_id && !user?.employee_id) {
      console.error('No candidate_id or employee_id found in user object!')
    }
  }, [user])

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.candidate_id && !user?.employee_id) {
        setLoadingProfile(false)
        return
      }
      const candidateId = user.candidate_id || user.employee_id
      try {
        const snap = await getDoc(doc(db, 'candidates', candidateId))
        if (!snap.exists()) { setLoadingProfile(false); return }
        const data = snap.data()
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          date_of_birth: data.date_of_birth || '',
          profile_photo_url: data.profile_photo_url || null,
        })
        if (data.profile_photo_url) setPhotoPreview(data.profile_photo_url)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
  }, [user])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be less than 2MB'); return }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoPreview(ev.target.result)
      reader.readAsDataURL(file)

      // Upload via backend — keeps Firebase Storage creds server-side
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = e => resolve(e.target.result.split(',')[1])
        r.onerror = () => reject(new Error('Failed to read file'))
        r.readAsDataURL(file)
      })
      const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
      const uploadRes = await fetch(base ? `${base}/api/documents/upload` : '/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: user?.candidate_id || 'profile',
          docType: 'profile_photo',
          base64, mimeType: file.type, fileName: file.name,
        }),
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')
      const publicUrl = uploadData.download_url
      setForm(f => ({ ...f, profile_photo_url: publicUrl }))
      toast.success('Photo uploaded!')
    } catch (err) {
      console.error('Photo upload error:', err)
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneRegex = /^[6-9]\d{9}$/
    if (!form.full_name?.trim()) { toast.error('Please enter your full name'); return }
    if (!form.address?.trim()) { toast.error('Please enter your address'); return }
    if (!form.date_of_birth) { toast.error('Please enter your date of birth'); return }

    const phone = form.phone.trim()

    if (!phone) {
      toast.error('Please enter your phone number')
      return
    }

    if (!phoneRegex.test(phone)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
if (form.emergency_contact_phone?.trim()) {
  const emergencyPhone = form.emergency_contact_phone.trim()

  if (!phoneRegex.test(emergencyPhone)) {
    toast.error('Enter a valid emergency contact number')
    return
  }
}
    let candidateId = user?.candidate_id || user?.employee_id

    // Fallback: look up by email if id is missing/corrupted
    if (!candidateId || candidateId === 'null' || candidateId === 'undefined') {
      console.log('No valid candidate_id, trying to find by email:', user?.email)
      try {
        // Try personal_email first, then work_email
        let qSnap = await getDocs(query(
          collection(db, 'candidates'), where('personal_email', '==', user?.email)
        ))
        if (qSnap.empty) {
          qSnap = await getDocs(query(
            collection(db, 'candidates'), where('work_email', '==', user?.email)
          ))
        }
        if (qSnap.empty) { toast.error('Could not find your candidate record. Please contact HR.'); return }
        candidateId = qSnap.docs[0].id
        await updateDoc(doc(db, 'profiles', user.id), { candidate_id: candidateId })
      } catch (err) {
        toast.error('User session error. Please contact HR.')
        console.error('Failed to find candidate:', err)
        return
      }
    }

    setLoading(true)
    try {
      const updateData = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        emergency_contact_name: form.emergency_contact_name?.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
        date_of_birth: form.date_of_birth,
        profile_photo_url: form.profile_photo_url || null,
        profile_completed: true,
      }
      await updateDoc(doc(db, 'candidates', candidateId), updateData)
      toast.success('Profile saved!')

      // 1. Mark Profile Completed in checklist
      completeByTitle.mutate({
        candidateId,
        title: 'Profile Completed',
        description: 'Personal profile and photo uploaded',
        category: 'hr',
        sort_order: 0,
      })

      // 2. Generate ID card HTML and send by email (non-blocking)
      ;(async () => {
        try {
          const snap  = await getDoc(doc(db, 'candidates', candidateId))
          const cData = snap.exists() ? snap.data() : {}
          const base  = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
          const idRes = await fetch(`${base}/api/sendmail/idcard`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail:    cData.personal_email || cData.login_email,
              toName:     form.full_name || cData.full_name,
              candidateId,
              position:   cData.position   || '',
              department: cData.department || '',
              workEmail:  cData.work_email || '',
              employeeId: candidateId.slice(-6).toUpperCase(),
              photoUrl:   form.profile_photo_url || cData.profile_photo_url || null,
              startDate:  cData.start_date || '',
            }),
          })
          if (idRes.ok) {
            toast.success('ID card sent to your email! 🪪')
            // Mark ID Card Issued in checklist
            completeByTitle.mutate({
              candidateId,
              title: 'ID Card Issued',
              description: 'Company ID card generated and sent',
              category: 'hr',
              sort_order: 7,
            })
          } else {
            const err = await idRes.json().catch(() => ({}))
            console.warn('[profile] ID card email failed:', err.error || idRes.status)
          }
        } catch (idErr) {
          console.warn('[profile] ID card generation error:', idErr.message)
        }
      })()

      navigate('/onboarding/terms')
    } catch (err) {
      console.error('Profile update error:', err)
      toast.error(`Failed to save: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-white">Complete Your Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Help us get to know you better</p>
      </div>

      {loadingProfile ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading your profile...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 animate-slide-up opacity-0"
            style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
            <h2 className="font-display font-semibold text-white text-sm mb-4">Profile Photo</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center">
                  {photoPreview
                    ? <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    : <span className="text-3xl text-indigo-400">📷</span>}
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all">
                  <span>📤</span><span>Upload Photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
                <p className="text-xs text-slate-500 mt-2">JPG, PNG . Max 2MB.</p>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 animate-slide-up opacity-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
            <h2 className="font-display font-semibold text-white text-sm mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name *</label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Enter your full name" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Date of Birth *</label>
                <input type="date" value={form.date_of_birth}
                  onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all"
                  required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number *</label>
                <input type="tel" value={form.phone}  maxLength={10}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Phone Number" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Address *</label>
                <textarea value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                  placeholder="House name, street, city, state, PIN" required />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#0C1A1D] p-6 animate-slide-up opacity-0"
            style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
            <h2 className="font-display font-semibold text-white text-sm mb-4">Emergency Contact (Optional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Contact Name</label>
                <input type="text" value={form.emergency_contact_name}
                  onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Contact Phone</label>
                <input type="tel" value={form.emergency_contact_phone}  maxLength={10}
                  onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                  className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Phone Number" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 animate-slide-up opacity-0"
            style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
            <button type="button" onClick={() => navigate('/onboarding')} disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
              Back
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {form.full_name ? 'Update Profile →' : 'Continue →'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}