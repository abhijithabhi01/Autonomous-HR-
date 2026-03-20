// src/hooks/useData.js
// Firebase/Firestore data hooks.
// Welcome emails sent via Resend through Firebase Cloud Functions proxy.

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, doc,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useAuth }     from './useAuth'
import toast           from 'react-hot-toast'

// ── helpers ──────────────────────────────────────────────────
function now() { return new Date().toISOString() }

function addExpiryStatus(d) {
  if (!d.expiry_date) return { ...d, expiry_status: 'ok', days_until_expiry: null }
  const days = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000)
  const expiry_status =
    days < 0   ? 'expired'  :
    days < 30  ? 'critical' :
    days < 90  ? 'warning'  :
    days < 180 ? 'notice'   : 'ok'
  return { ...d, expiry_status, days_until_expiry: days }
}

function labelForType(type) {
  return {
    passport:          'Passport',
    visa:              'Visa / Work Permit',
    degree:            'Degree Certificate',
    employment_letter: 'Employment Letter',
    bank_details:      'Bank Details',
    aadhaar:           'Aadhaar Card',
    pan_card:          'PAN Card',
  }[type] || type
}
function iconForType(type) {
  return { passport:'-', visa:'-', degree:'-', employment_letter:'-',
           bank_details:'-', aadhaar:'-', pan_card:'-' }[type] || '-'
}

// ============================================================
// WELCOME EMAIL  — direct Resend API call (no backend needed)
// ============================================================
// Add to .env:
//   VITE_RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
//   VITE_RESEND_FROM=HR Team <onboarding@resend.dev>
//
// "from" address:
//   • Use  onboarding@resend.dev  while testing (Resend sandbox, free)
//   • For production verify your domain at resend.com/domains
// ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ toEmail, toName, loginEmail, tempPassword, position, department, startDate }) {
  const API_KEY   = import.meta.env.VITE_RESEND_API_KEY
  const FROM_ADDR = import.meta.env.VITE_RESEND_FROM || 'HR Team <onboarding@resend.dev>'

  if (!API_KEY) {
    console.warn('[email] VITE_RESEND_API_KEY not set — skipping welcome email')
    throw new Error('VITE_RESEND_API_KEY not configured')
  }

  const firstName     = toName.split(' ')[0]
  const portalUrl     = window.location.origin + '/login'
  const formattedStart = startDate
    ? new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBD'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
          <div style="font-size:32px;margin-bottom:12px">🎉</div>
          <h1 style="margin:0;color:#2DD4BF;font-size:24px;font-weight:700">Welcome to D Company!</h1>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
            You're joining as <strong>${position}</strong> in <strong>${department}</strong>,
            starting <strong>${formattedStart}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 16px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Login Credentials</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr>
                  <td style="padding:6px 0;color:#64748b;width:100px">Portal</td>
                  <td><a href="${portalUrl}" style="color:#2DD4BF">${portalUrl}</a></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b">Email</td>
                  <td style="font-weight:600;color:#0f172a">${loginEmail}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b">Password</td>
                  <td><code style="background:#e2e8f0;padding:3px 8px;border-radius:6px;font-weight:600">${tempPassword}</code></td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:12px 24px;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8">⚠️ Change your password after first login.</p>
            </td></tr>
          </table>
          <p style="margin:0;font-size:14px;color:#94a3b8">The HR Team · D Company</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_ADDR,
      to:      [toEmail],
      subject: `Welcome to D Company, ${firstName}! 🎉 Your login details`,
      html,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || 'Resend error ' + res.status)
  return data
}

// ============================================================
// CANDIDATES
// ============================================================

export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn: async () => {
      const q    = query(collection(db, 'candidates'), where('graduated_at', '==', null), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })
}

export function useCandidate(id) {
  return useQuery({
    queryKey: ['candidate', id],
    enabled:  !!id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'candidates', id))
      if (!snap.exists()) throw new Error('Candidate not found')
      return { id: snap.id, ...snap.data() }
    },
  })
}

export function useAddCandidate() {
  const queryClient = useQueryClient()
  const { signUp }  = useAuth()

  return useMutation({
    mutationFn: async (fields) => {
      const avatar        = fields.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
      const nameParts     = fields.full_name.toLowerCase().trim().split(/\s+/)
      const workEmail     = nameParts.join('.') + '@dcompany.com'
      const personalEmail = fields.personal_email?.trim() || null

      // ── Guard: personal email must be unique ─────────────────
      if (personalEmail) {
        const check = await getDocs(query(collection(db, 'candidates'), where('personal_email', '==', personalEmail)))
        if (!check.empty) throw new Error(`A candidate with the email "${personalEmail}" already exists.`)
      }

      // ── Guard: work email uniqueness (handles duplicate names) ─
      let finalEmail = workEmail
      const existing = await getDocs(query(collection(db, 'candidates'), where('work_email', '==', workEmail)))
      if (!existing.empty) {
        let suffix = 2
        while (suffix <= 99) {
          const e     = nameParts.join('.') + suffix + '@dcompany.com'
          const taken = await getDocs(query(collection(db, 'candidates'), where('work_email', '==', e)))
          if (taken.empty) { finalEmail = e; break }
          suffix++
        }
      }

      // 1. Candidate document
      const candidateRef = await addDoc(collection(db, 'candidates'), {
        avatar,
        full_name:           fields.full_name,
        work_email:          finalEmail,
        personal_email:      personalEmail,
        position:            fields.position,
        department:          fields.department,
        start_date:          fields.start_date || null,
        manager:             fields.manager    || null,
        location:            fields.location   || null,
        onboarding_status:   'pre_joining',
        onboarding_progress: 0,
        graduated_at:        null,
        created_at:          now(),
      })

      // 2. Seed checklist
      await Promise.all([
        { title: 'Profile Completed',     description: 'Personal profile and photo uploaded',     category: 'hr',        sort_order: 0  },
        { title: 'Contract Signed',       description: 'Employment contract digitally signed',     category: 'legal',     sort_order: 1  },
        { title: 'Documents Submitted',   description: 'All required documents uploaded',          category: 'documents', sort_order: 2  },
        { title: 'Documents Verified',    description: 'AI verification of all documents',         category: 'documents', sort_order: 3  },
        { title: 'Company Email Created', description: 'Google Workspace account provisioned',     category: 'it',        sort_order: 4  },
        { title: 'System Access Granted', description: 'Access to required tools and platforms',  category: 'it',        sort_order: 5  },
        { title: 'Payroll Setup',         description: 'Salary account and payroll configured',   category: 'hr',        sort_order: 6  },
        { title: 'ID Card Issued',        description: 'Company ID card processed and issued',    category: 'hr',        sort_order: 7  },
        { title: 'Policy Training',       description: 'Mandatory compliance and policy training', category: 'training',  sort_order: 8  },
        { title: 'Team Introduction',     description: 'Met with immediate team and manager',      category: 'social',    sort_order: 9  },
        { title: 'Day 7 Check-in',        description: 'One week wellbeing check-in',             category: 'wellbeing', sort_order: 10 },
      ].map(item => addDoc(collection(db, 'checklist_items'), { ...item, candidate_id: candidateRef.id, completed: false, completed_at: null })))

      // 3. IT provisioning request
      await addDoc(collection(db, 'provisioning_requests'), {
        candidate_id:        candidateRef.id,
        candidate_name:      fields.full_name,
        work_email:          finalEmail,
        position:            fields.position,
        department:          fields.department,
        manager:             fields.manager  || null,
        location:            fields.location || null,
        start_date:          fields.start_date || null,
        status:              'pending',
        systems_provisioned: {},
        created_at:          now(),
      })

      // 4. Firebase Auth account (secondary app — HR session untouched)
      const tempPassword = 'Welcome' + Math.floor(1000 + Math.random() * 9000) + '!'
      const loginEmail   = personalEmail || finalEmail   // what the candidate uses to sign in
      try {
        await signUp({ email: loginEmail, password: tempPassword, name: fields.full_name, role: 'employee', candidate_id: candidateRef.id })
      } catch (err) {
        console.warn('[useAddCandidate] Auth creation non-fatal:', err.message)
      }

      // 5. Welcome email via Resend (through Cloud Function)
      let emailSent = false
      try {
        await sendWelcomeEmail({
          toEmail:     personalEmail || finalEmail,
          toName:      fields.full_name,
          loginEmail,                               // shown in email body — matches Firebase Auth
          tempPassword,
          position:    fields.position,
          department:  fields.department,
          startDate:   fields.start_date,
        })
        emailSent = true
      } catch (emailErr) {
        console.warn('[useAddCandidate] Email non-fatal:', emailErr.message)
      }

      return { candidate: { id: candidateRef.id, ...fields }, loginEmail, workEmail: finalEmail, tempPassword, emailSent }
    },

    onSuccess: ({ candidate, loginEmail, workEmail, tempPassword, emailSent }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
      toast.success(
        `✅ ${candidate.full_name} added!\n\n` +
        `🔑 Login: ${loginEmail}\n` +
        `🔐 Password: ${tempPassword}\n` +
        `📧 Work email: ${workEmail}\n\n` +
        (emailSent ? `✉️ Welcome email sent to ${loginEmail}` : `⚠️ Email failed — check FUNCTIONS_URL + RESEND_API_KEY`),
        { duration: 18000, style: { background: '#0C1120', color: '#E2E8F0', border: '1px solid rgba(20,184,166,0.3)', borderRadius: '12px', fontSize: '13px', whiteSpace: 'pre-line', maxWidth: '440px' } }
      )
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => { await deleteDoc(doc(db, 'candidates', id)); return id },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
      toast.success('Candidate removed')
    },
    onError: (err) => toast.error(err.message),
  })
}

// ============================================================
// EMPLOYEES
// ============================================================

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'employees'), orderBy('joined_at', 'desc')))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })
}

export function useEmployee(id) {
  return useQuery({
    queryKey: ['employee', id],
    enabled:  !!id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'employees', id))
      if (!snap.exists()) throw new Error('Employee not found')
      return { id: snap.id, ...snap.data() }
    },
  })
}

// ============================================================
// DOCUMENTS
// ============================================================

export function useDocuments(candidateId) {
  return useQuery({
    queryKey: ['documents', candidateId],
    enabled:  !!candidateId,
    queryFn: async () => {
      const q    = query(collection(db, 'documents'), where('candidate_id', '==', candidateId), orderBy('type'))
      const snap = await getDocs(q)
      return snap.docs.map(d => addExpiryStatus({ id: d.id, ...d.data() }))
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, docType, file, extractedData }) => {
      const ext      = file.name.split('.').pop()
      const path     = candidateId + '/' + docType + '_' + Date.now() + '.' + ext
      const fileRef  = ref(storage, 'documents/' + path)
      await uploadBytes(fileRef, file)
      const downloadUrl = await getDownloadURL(fileRef)

      const docData = {
        candidate_id:   candidateId,
        type:           docType,
        label:          labelForType(docType),
        icon:           iconForType(docType),
        status:         extractedData ? 'verified' : 'uploaded',
        uploaded_at:    now(),
        storage_path:   path,
        download_url:   downloadUrl,
        extracted_data: extractedData || null,
        expiry_date:    extractedData?.expiry_date || null,
      }

      const existing = await getDocs(query(collection(db, 'documents'), where('candidate_id', '==', candidateId), where('type', '==', docType)))
      let docId
      if (!existing.empty) {
        docId = existing.docs[0].id
        await updateDoc(doc(db, 'documents', docId), docData)
      } else {
        const newDoc = await addDoc(collection(db, 'documents'), docData)
        docId = newDoc.id
      }
      return { id: docId, ...docData }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', data.candidate_id] })
      toast.success('Document uploaded successfully')
    },
    onError: (err) => toast.error(err.message),
  })
}

export async function getDocumentUrl(storagePath) {
  return getDownloadURL(ref(storage, 'documents/' + storagePath))
}

// ============================================================
// CHECKLIST
// ============================================================

export function useChecklist(candidateId) {
  return useQuery({
    queryKey: ['checklist', candidateId],
    enabled:  !!candidateId,
    queryFn: async () => {
      const q    = query(collection(db, 'checklist_items'), where('candidate_id', '==', candidateId), orderBy('sort_order'))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })
}

export function useToggleChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed, candidateId }) => {
      const data = { completed, completed_at: completed ? now() : null }
      await updateDoc(doc(db, 'checklist_items', id), data)
      return { id, ...data, candidateId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklist', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', data.candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useCompleteChecklistByTitle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, title, description, category, sort_order }) => {
      if (!candidateId) return null
      const snap       = await getDocs(query(collection(db, 'checklist_items'), where('candidate_id', '==', candidateId)))
      const titleLower = title.toLowerCase()
      const match      = snap.docs.find(d => d.data().title.toLowerCase() === titleLower)
      const completedData = { completed: true, completed_at: now() }

      if (match) {
        if (match.data().completed) return null
        await updateDoc(doc(db, 'checklist_items', match.id), completedData)
        return { id: match.id, ...completedData, candidateId }
      }
      const newDoc = await addDoc(collection(db, 'checklist_items'), {
        candidate_id: candidateId, title, description: description || title,
        category: category || 'hr', sort_order: sort_order ?? 99, ...completedData,
      })
      return { id: newDoc.id, ...completedData, candidateId }
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

export function useMarkOnboardingComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId) => {
      await updateDoc(doc(db, 'candidates', candidateId), { onboarding_status: 'completed', onboarding_progress: 100, completed_at: now() })
      return { id: candidateId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', data.id] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => console.warn('[useMarkOnboardingComplete]', err.message),
  })
}

// ============================================================
// ALERTS
// ============================================================

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const q    = query(collection(db, 'alerts'), where('resolved', '==', false), orderBy('severity', 'desc'), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })
}

export function useResolveAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alertId) => {
      await updateDoc(doc(db, 'alerts', alertId), { resolved: true, resolved_at: now() })
      return alertId
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); toast.success('Alert resolved') },
    onError:   (err) => toast.error(err.message),
  })
}

// ============================================================
// PROVISIONING
// ============================================================

export function useProvisioningRequests() {
  return useQuery({
    queryKey: ['provisioning_requests'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'provisioning_requests'), orderBy('created_at', 'desc')))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },
  })
}

export function useUpdateProvisioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      await updateDoc(doc(db, 'provisioning_requests', id), { ...patch, updated_at: now() })
      return { id, ...patch }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] }),
    onError:   (err) => toast.error(err.message),
  })
}

// ============================================================
// POLICY CHAT
// ============================================================

export function useCreatePolicySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, employeeId }) => {
      const docRef = await addDoc(collection(db, 'policy_sessions'), { candidate_id: candidateId || null, employee_id: employeeId || null, created_at: now() })
      return { id: docRef.id }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policy_sessions'] }),
  })
}

export function useAddPolicyMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, role, content, sourceSection, confidence, isLocal }) => {
      const docRef = await addDoc(collection(db, 'policy_messages'), {
        session_id: sessionId, role, content,
        source_section: sourceSection || null, confidence: confidence || null, is_local: isLocal || false, created_at: now(),
      })
      return { id: docRef.id, session_id: sessionId }
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ['policy_messages', data.session_id] }),
  })
}

// ============================================================
// REALTIME SYNC
// ============================================================
export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubCandidates = onSnapshot(
      query(collection(db, 'candidates'), where('graduated_at', '==', null)),
      () => { queryClient.invalidateQueries({ queryKey: ['candidates'] }); queryClient.invalidateQueries({ queryKey: ['candidate'] }) }
    )
    const unsubChecklist = onSnapshot(
      collection(db, 'checklist_items'),
      () => { queryClient.invalidateQueries({ queryKey: ['checklist'] }); queryClient.invalidateQueries({ queryKey: ['candidates'] }) }
    )
    const unsubDocs = onSnapshot(
      collection(db, 'documents'),
      () => queryClient.invalidateQueries({ queryKey: ['documents'] })
    )
    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), where('resolved', '==', false)),
      () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
    )
    console.log('[realtime] Firebase onSnapshot listeners active')
    return () => { unsubCandidates(); unsubChecklist(); unsubDocs(); unsubAlerts() }
  }, [queryClient])
}