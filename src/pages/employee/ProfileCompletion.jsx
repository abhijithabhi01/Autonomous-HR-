import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ProfileCompletion() {
  const navigate = useNavigate()
  const { user } = useAuth()
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

  // Debug: Check user context on mount (only after loading completes)
  useEffect(() => {
    console.log('User context:', user)
    // Only show error if user is loaded but missing candidate_id
    // Don't show error while user is null (still loading)
    if (user && !user?.candidate_id && !user?.employee_id) {
      console.error('No candidate_id or employee_id found in user object!')
      // Don't show toast here - we'll handle it in the submit function
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
        const { data, error } = await supabase
          .from('candidates')
          .select('full_name, phone, address, emergency_contact_name, emergency_contact_phone, date_of_birth, profile_photo_url, profile_completed')
          .eq('id', candidateId)
          .single()

        if (error) {
          console.error('Error loading profile:', error)
          setLoadingProfile(false)
          return
        }

        if (data) {
          console.log('Loaded existing profile:', data)
          
          // Populate form with existing data
          setForm({
            full_name: data.full_name || '',
            phone: data.phone || '',
            address: data.address || '',
            emergency_contact_name: data.emergency_contact_name || '',
            emergency_contact_phone: data.emergency_contact_phone || '',
            date_of_birth: data.date_of_birth || '',
            profile_photo_url: data.profile_photo_url || null,
          })

          // Set photo preview if exists
          if (data.profile_photo_url) {
            setPhotoPreview(data.profile_photo_url)
          }
        }
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 2MB instead of 5MB for better performance)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setUploading(true)
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => setPhotoPreview(e.target.result)
      reader.readAsDataURL(file)

      // Upload to Supabase storage with unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      console.log('Uploading file:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: false 
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      console.log('Upload successful:', uploadData)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName)

      console.log('Public URL:', urlData.publicUrl)

      setForm(f => ({ ...f, profile_photo_url: urlData.publicUrl }))
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
    
    // Validation
    if (!form.full_name?.trim()) {
      toast.error('Please enter your full name')
      return
    }
    if (!form.phone?.trim()) {
      toast.error('Please enter your phone number')
      return
    }
    if (!form.address?.trim()) {
      toast.error('Please enter your address')
      return
    }
    if (!form.date_of_birth) {
      toast.error('Please enter your date of birth')
      return
    }

    // Check user context - handle string "null" as well
    let candidateId = user?.candidate_id || user?.employee_id
    
    // Handle string "null" or actual null
    if (!candidateId || candidateId === 'null' || candidateId === 'undefined') {
      // Try to find candidate by email instead
      console.log('No valid candidate_id, trying to find by email:', user?.email)
      
      try {
        const { data: candidates, error } = await supabase
          .from('candidates')
          .select('id')
          .eq('work_email', user?.email)
          .single()
        
        if (error || !candidates) {
          toast.error('Could not find your candidate record. Please contact HR.')
          console.error('Candidate lookup error:', error)
          return
        }
        
        candidateId = candidates.id
        console.log('Found candidate by email:', candidateId)
        
        // Update the profile with the correct candidate_id for future use
        await supabase
          .from('profiles')
          .update({ candidate_id: candidateId })
          .eq('id', user.id)
          
      } catch (err) {
        toast.error('User session error. Please contact HR.')
        console.error('Failed to find candidate:', err)
        return
      }
    }

    console.log('Submitting profile for candidate:', candidateId)
    console.log('Form data:', form)

    setLoading(true)
    try {
      // Update candidate record
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

      console.log('Update data:', updateData)

      const { data, error } = await supabase
        .from('candidates')
        .update(updateData)
        .eq('id', candidateId)
        .select()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Update successful:', data)

      toast.success('Profile completed!')
      navigate('/onboarding/terms')
    } catch (err) {
      console.error('Profile update error:', err)
      
      // More detailed error message
      if (err.message.includes('column')) {
        toast.error('Database error: Missing columns. Please run the migration SQL.')
      } else if (err.code === '42703') {
        toast.error('Database column missing. Contact your administrator.')
      } else {
        toast.error(`Failed to save: ${err.message}`)
      }
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
            {/* Photo Preview */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-indigo-400">📷</span>
                )}
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all">
                <span>📤</span>
                <span>Upload Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
              </label>
              <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
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
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Date of Birth *</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                placeholder="+91 98765 43210"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Address *</label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={3}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                placeholder="House name, street, city, state, PIN"
                required
              />
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
              <input
                type="text"
                value={form.emergency_contact_name}
                onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Contact Phone</label>
              <input
                type="tel"
                value={form.emergency_contact_phone}
                onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                className="w-full bg-[#080C18] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 animate-slide-up opacity-0"
          style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-50">
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
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