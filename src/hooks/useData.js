// src/hooks/useData.js
import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ════════════════════════════════════════════════════════════
// CANDIDATES
// ════════════════════════════════════════════════════════════

export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .is('graduated_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCandidate(id) {
  return useQuery({
    queryKey: ['candidate', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useAddCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields) => {
      const avatar        = fields.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
      const nameParts     = fields.full_name.toLowerCase().trim().split(/\s+/)
      const baseEmail     = `${nameParts.join('.')}@dcompany.com`

      // Ensure the work email is unique — if base is taken, append a number (e.g. abhijith.s2@dcompany.com)
      let workEmail = baseEmail
      let suffix    = 2
      while (true) {
        const { data: existing } = await supabase
          .from('candidates')
          .select('id')
          .eq('work_email', workEmail)
          .maybeSingle()
        if (!existing) break           // email is free
        workEmail = `${nameParts.join('.')}${suffix}@dcompany.com`
        suffix++
        if (suffix > 99) break         // safety — should never reach here
      }
      const personalEmail = fields.personal_email?.trim() || null

      const { data: candidate, error: candError } = await supabase
        .from('candidates')
        .insert({
          avatar,
          full_name:           fields.full_name,
          work_email:          workEmail,
          personal_email:      personalEmail,
          position:            fields.position,
          department:          fields.department,
          start_date:          fields.start_date,
          manager:             fields.manager  || null,
          location:            fields.location || null,
          onboarding_status:   'pre_joining',
          onboarding_progress: 0,
        })
        .select()
        .single()
      if (candError) throw candError

      const checklistItems = [
        { title: 'Profile Completed',     description: 'Personal profile and photo uploaded',      category: 'hr',        sort_order: 0  },
        { title: 'Contract Signed',       description: 'Employment contract digitally signed',    category: 'legal',     sort_order: 1  },
        { title: 'Documents Submitted',   description: 'All required documents uploaded',          category: 'documents', sort_order: 2  },
        { title: 'Documents Verified',    description: 'AI verification of all documents',         category: 'documents', sort_order: 3  },
        { title: 'Company Email Created', description: 'Google Workspace account provisioned',     category: 'it',        sort_order: 4  },
        { title: 'System Access Granted', description: 'Access to required tools and platforms',  category: 'it',        sort_order: 5  },
        { title: 'Payroll Setup',         description: 'Salary account and payroll configured',   category: 'hr',        sort_order: 6  },
        { title: 'ID Card Issued',        description: 'Company ID card processed and issued',    category: 'hr',        sort_order: 7  },
        { title: 'Policy Training',       description: 'Mandatory compliance and policy training', category: 'training',  sort_order: 8  },
        { title: 'Team Introduction',     description: 'Met with immediate team and manager',      category: 'social',    sort_order: 9  },
        { title: 'Day 7 Check-in',        description: 'One week wellbeing check-in',             category: 'wellbeing', sort_order: 10 },
      ]
      await supabase.from('checklist_items').insert(
        checklistItems.map(item => ({ ...item, candidate_id: candidate.id }))
      )

      await supabase.from('provisioning_requests').insert({
        candidate_id:        candidate.id,
        candidate_name:      candidate.full_name,
        work_email:          workEmail,
        position:            candidate.position,
        department:          candidate.department,
        manager:             candidate.manager    || null,
        location:            candidate.location   || null,
        start_date:          candidate.start_date || null,
        status:              'pending',
        systems_provisioned: {},
      })

      let tempPassword = null
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('send-onboarding-email', {
          body: {
            candidateName: candidate.full_name,
            workEmail,
            personalEmail,
            position:      candidate.position,
            department:    candidate.department,
            startDate:     candidate.start_date || null,
          },
        })
        if (fnError) console.warn('[useAddCandidate] Edge function warning:', fnError.message)
        if (fnData?.tempPassword) tempPassword = fnData.tempPassword
      } catch (err) {
        console.warn('[useAddCandidate] Edge function non-fatal:', err.message)
      }

      return { candidate, workEmail, tempPassword, personalEmail }
    },

    onSuccess: ({ candidate, workEmail, tempPassword, personalEmail }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
      const sentTo = personalEmail || workEmail
      toast.success(
        `✅ ${candidate.full_name} added!\n\n🏢 Login: ${workEmail}\n🔑 Password: ${tempPassword}\n\n📧 Welcome email sent to ${sentTo}`,
        {
          duration: 16000,
          style: {
            background: '#0C1120', color: '#E2E8F0',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: '12px', fontSize: '13px',
            whiteSpace: 'pre-line', maxWidth: '420px',
          },
        }
      )
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
      toast.success('Candidate removed')
    },
    onError: (err) => toast.error(err.message),
  })
}

// ════════════════════════════════════════════════════════════
// EMPLOYEES
// ════════════════════════════════════════════════════════════

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('joined_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useEmployee(id) {
  return useQuery({
    queryKey: ['employee', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

// ════════════════════════════════════════════════════════════
// DOCUMENTS
// ════════════════════════════════════════════════════════════

export function useDocuments(candidateId) {
  return useQuery({
    queryKey: ['documents', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_with_expiry')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('type')
      if (error) throw error
      return data
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, docType, file, extractedData }) => {
      const ext  = file.name.split('.').pop()
      const path = `${candidateId}/${docType}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('documents')
        .upsert({
          candidate_id:   candidateId,
          type:           docType,
          label:          labelForType(docType),
          status:         extractedData ? 'verified' : 'uploaded',
          uploaded_at:    new Date().toISOString(),
          storage_path:   path,
          extracted_data: extractedData ?? null,
          expiry_date:    extractedData?.expiry_date ?? null,
        }, { onConflict: 'candidate_id,type' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', data.candidate_id] })
      toast.success('Document uploaded successfully')
    },
    onError: (err) => toast.error(err.message),
  })
}

export async function getDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 5)
  if (error) throw error
  return data.signedUrl
}

// ════════════════════════════════════════════════════════════
// CHECKLIST
// ════════════════════════════════════════════════════════════

export function useChecklist(candidateId) {
  return useQuery({
    queryKey: ['checklist', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useToggleChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed, candidateId }) => {
      const { data, error } = await supabase
        .from('checklist_items')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, candidateId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklist', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => toast.error(err.message),
  })
}

// ── Auto-complete checklist item by title ─────────────────────
// Used by TermsAndConditions, Documents, ProfileCompletion.
// Idempotent — silently skips if item not found or already done.
export function useCompleteChecklistByTitle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, title, description = '', category = 'hr', sort_order = 99 }) => {
      if (!candidateId) return null

      // 1. Check if item already exists (completed or not)
      const { data: existing } = await supabase
        .from('checklist_items')
        .select('id, completed')
        .eq('candidate_id', candidateId)
        .ilike('title', title)
        .maybeSingle()

      // 2a. Already completed — nothing to do
      if (existing?.completed) {
        console.log('[checklist] Already completed:', title)
        return null
      }

      const now = new Date().toISOString()

      // 2b. Item exists but not completed — update it
      if (existing?.id) {
        const { data, error } = await supabase
          .from('checklist_items')
          .update({ completed: true, completed_at: now })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        console.log('[checklist] ✅ Marked complete:', title)
        return { ...data, candidateId }
      }

      // 2c. Item does not exist — insert it as already completed (for existing candidates)
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          candidate_id: candidateId,
          title,
          description: description || title,
          category,
          sort_order,
          completed:    true,
          completed_at: now,
        })
        .select()
        .single()
      if (error) throw error
      console.log('[checklist] ✅ Inserted + completed:', title)
      return { ...data, candidateId }
    },
    onSuccess: (data) => {
      if (!data) return
      queryClient.invalidateQueries({ queryKey: ['checklist', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => console.warn('[useCompleteChecklistByTitle]', err.message),
  })
}

// ── Mark onboarding complete ──────────────────────────────────
// Called by Checklist.jsx when all items reach 100%
export function useMarkOnboardingComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId) => {
      const { data, error } = await supabase
        .from('candidates')
        .update({
          onboarding_status:   'completed',
          onboarding_progress: 100,
          completed_at:        new Date().toISOString(),
        })
        .eq('id', candidateId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', data.id] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => console.warn('[useMarkOnboardingComplete]', err.message),
  })
}

// ════════════════════════════════════════════════════════════
// ALERTS
// ════════════════════════════════════════════════════════════

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('resolved', false)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useResolveAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alertId) => {
      const { error } = await supabase
        .from('alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId)
      if (error) throw error
      return alertId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert resolved')
    },
    onError: (err) => toast.error(err.message),
  })
}

// ════════════════════════════════════════════════════════════
// PROVISIONING
// ════════════════════════════════════════════════════════════

export function useProvisioningRequests() {
  return useQuery({
    queryKey: ['provisioning_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provisioning_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProvisioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { data, error } = await supabase
        .from('provisioning_requests')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
    },
    onError: (err) => toast.error(err.message),
  })
}

// ════════════════════════════════════════════════════════════
// POLICY CHAT
// ════════════════════════════════════════════════════════════

export function useCreatePolicySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, employeeId }) => {
      const { data, error } = await supabase
        .from('policy_sessions')
        .insert({ candidate_id: candidateId || null, employee_id: employeeId || null })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_sessions'] })
    },
  })
}

export function useAddPolicyMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, role, content, sourceSection, confidence, isLocal }) => {
      const { data, error } = await supabase
        .from('policy_messages')
        .insert({
          session_id:     sessionId,
          role,
          content,
          source_section: sourceSection ?? null,
          confidence:     confidence    ?? null,
          is_local:       isLocal       ?? false,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['policy_messages', data.session_id] })
    },
  })
}

// ════════════════════════════════════════════════════════════
// REAL-TIME SYNC
// Call useRealtimeSync() once in HRLayout — keeps all HR
// queries fresh without any manual refresh.
// ════════════════════════════════════════════════════════════
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('hr-live-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['candidates'] })
          queryClient.invalidateQueries({ queryKey: ['candidate'] })
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['checklist'] })
          queryClient.invalidateQueries({ queryKey: ['candidates'] })
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['documents'] })
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[realtime] ✅ HR live sync connected')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function labelForType(type) {
  return {
    passport:          'Passport',
    visa:              'Visa / Work Permit',
    degree:            'Degree Certificate',
    employment_letter: 'Employment Letter',
    bank_details:      'Bank Details',
    aadhaar:           'Aadhaar Card',
    pan_card:          'PAN Card',
  }[type] ?? type
}
