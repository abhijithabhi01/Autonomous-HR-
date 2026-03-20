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
    passport: 'Passport', visa: 'Visa / Work Permit', degree: 'Degree Certificate',
    employment_letter: 'Employment Letter', bank_details: 'Bank Details',
    aadhaar: 'Aadhaar Card', pan_card: 'PAN Card',
  }[type] || type
}
function iconForType(type) {
  return { passport:'-', visa:'-', degree:'-', employment_letter:'-',
           bank_details:'-', aadhaar:'-', pan_card:'-' }[type] || '-'
}

// ============================================================
// WELCOME EMAIL — via Vercel serverless function → Resend
// ============================================================
// Deploy setup:
//   1. npm install -g vercel
//   2. vercel login
//   3. vercel deploy  (from project root)
//   4. Add RESEND_API_KEY + RESEND_FROM in Vercel dashboard → Settings → Env Vars
//   5. Redeploy after adding env vars
//
// Local dev: run  vercel dev  instead of  npm run dev
//            (serves Vite + /api/* functions on the same port)
//
// The /api/send-email endpoint is defined in  api/send-email.js
// at the project root (next to package.json).
// ─────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ toEmail, toName, loginEmail, tempPassword, position, department, startDate }) {
  const res = await fetch('/api/sendmail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toEmail, toName, loginEmail, tempPassword,
      position, department, startDate: startDate || null,
      portalUrl: window.location.origin + '/login',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Email API returned ' + res.status)
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

      // ── personal email uniqueness ─────────────────────────
      if (personalEmail) {
        const check = await getDocs(query(collection(db, 'candidates'), where('personal_email', '==', personalEmail)))
        if (!check.empty) throw new Error(`A candidate with "${personalEmail}" already exists.`)
      }

      // ── work email uniqueness ─────────────────────────────
      let finalEmail = workEmail
      const existing = await getDocs(query(collection(db, 'candidates'), where('work_email', '==', workEmail)))
      if (!existing.empty) {
        let suffix = 2
        while (suffix <= 99) {
          const e = nameParts.join('.') + suffix + '@dcompany.com'
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
        start_date:          fields.start_date  || null,
        manager:             fields.manager     || null,
        location:            fields.location    || null,
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
      ].map(item => addDoc(collection(db, 'checklist_items'), {
        ...item, candidate_id: candidateRef.id, completed: false, completed_at: null
      })))

      // 3. IT provisioning
      await addDoc(collection(db, 'provisioning_requests'), {
        candidate_id: candidateRef.id, candidate_name: fields.full_name,
        work_email: finalEmail, position: fields.position, department: fields.department,
        manager: fields.manager || null, location: fields.location || null,
        start_date: fields.start_date || null, status: 'pending',
        systems_provisioned: {}, created_at: now(),
      })

      // 4. Firebase Auth account + Firestore profile
      //    loginEmail = what the candidate uses to sign in.
      //    tempPassword stored on the candidate doc so HR always has access.
      const tempPassword = 'Welcome' + Math.floor(1000 + Math.random() * 9000) + '!'
      const loginEmail   = personalEmail || finalEmail
      let authCreated    = false

      try {
        await signUp({
          email:        loginEmail,
          password:     tempPassword,
          name:         fields.full_name,
          role:         'employee',
          candidate_id: candidateRef.id,
        })
        authCreated = true
        console.log('[useAddCandidate] Auth + profile created for', loginEmail)
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          // Auth account exists from a previous failed attempt.
          // The new signUp() uses REST API which prevents this going forward,
          // but existing orphaned accounts need a one-time manual fix:
          //   Firebase Console → Authentication → delete the account for this email
          //   then re-add the candidate here.
          //
          // Try to re-link if a profile exists:
          try {
            const profileSnap = await getDocs(
              query(collection(db, 'profiles'), where('email', '==', loginEmail))
            )
            if (!profileSnap.empty) {
              await updateDoc(doc(db, 'profiles', profileSnap.docs[0].id), {
                candidate_id: candidateRef.id,
              })
              authCreated = true
              console.log('[useAddCandidate] Re-linked existing auth account for', loginEmail)
            } else {
              // Orphaned auth account — profile was never created.
              // We cannot recover this programmatically from the client.
              // HR must delete the account in Firebase Console and re-add.
              console.warn('[useAddCandidate] ORPHANED AUTH — no profile for:', loginEmail)
              toast.error(
                `⚠️ Account already exists for ${loginEmail} but setup is incomplete.\n\n` +
                `Fix: Firebase Console → Authentication → delete ${loginEmail} → re-add this candidate.`,
                { duration: 15000, style: { background: '#1a0a0a', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', fontSize: '13px', whiteSpace: 'pre-line', maxWidth: '460px' } }
              )
            }
          } catch (linkErr) {
            console.error('[useAddCandidate] Profile re-link failed:', linkErr.message)
          }
        } else {
          console.error('[useAddCandidate] Auth/profile creation FAILED:', err.message)
        }
      }

      // Store temp credentials on candidate doc (HR reference, not shown to employee)
      await updateDoc(doc(db, 'candidates', candidateRef.id), {
        login_email:    loginEmail,
        temp_password:  tempPassword,
        auth_created:   authCreated,
        work_email:     finalEmail,
      })

      // 5. Welcome email via Vercel → Resend
      let emailSent = false
      try {
        await sendWelcomeEmail({
          toEmail:     personalEmail || finalEmail,
          toName:      fields.full_name,
          loginEmail,
          tempPassword,
          position:    fields.position,
          department:  fields.department,
          startDate:   fields.start_date,
        })
        emailSent = true
      } catch (emailErr) {
        console.warn('[useAddCandidate] Email failed:', emailErr.message)
      }

      return {
        candidate:   { id: candidateRef.id, ...fields },
        loginEmail,
        workEmail:   finalEmail,
        tempPassword,
        authCreated,
        emailSent,
      }
    },

    onSuccess: ({ candidate, loginEmail, workEmail, tempPassword, authCreated, emailSent }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })

      const authLine  = authCreated
        ? `✅ Login ready`
        : `⚠️ Auth creation failed — check console`
      const emailLine = emailSent
        ? `✉️  Email sent to ${loginEmail}`
        : `📋 Email not sent — share credentials manually`

      toast.success(
        `✅ ${candidate.full_name} added!\n\n` +
        `🔑 Login: ${loginEmail}\n` +
        `🔐 Password: ${tempPassword}\n` +
        `📧 Work email: ${workEmail}\n\n` +
        `${authLine}\n${emailLine}`,
        {
          duration: 20000,
          style: {
            background: '#0C1120', color: '#E2E8F0',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: '12px', fontSize: '13px',
            whiteSpace: 'pre-line', maxWidth: '460px',
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
      const ext  = file.name.split('.').pop()
      const path = candidateId + '/' + docType + '_' + Date.now() + '.' + ext
      const fileRef = ref(storage, 'documents/' + path)
      await uploadBytes(fileRef, file)
      const downloadUrl = await getDownloadURL(fileRef)

      const docData = {
        candidate_id: candidateId, type: docType,
        label: labelForType(docType), icon: iconForType(docType),
        status: extractedData ? 'verified' : 'uploaded',
        uploaded_at: now(), storage_path: path, download_url: downloadUrl,
        extracted_data: extractedData || null,
        expiry_date: extractedData?.expiry_date || null,
      }

      const existing = await getDocs(query(collection(db, 'documents'),
        where('candidate_id', '==', candidateId), where('type', '==', docType)))
      let docId
      if (!existing.empty) {
        docId = existing.docs[0].id
        await updateDoc(doc(db, 'documents', docId), docData)
      } else {
        const nd = await addDoc(collection(db, 'documents'), docData)
        docId = nd.id
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
      const done       = { completed: true, completed_at: now() }
      if (match) {
        if (match.data().completed) return null
        await updateDoc(doc(db, 'checklist_items', match.id), done)
        return { id: match.id, ...done, candidateId }
      }
      const nd = await addDoc(collection(db, 'checklist_items'), {
        candidate_id: candidateId, title, description: description || title,
        category: category || 'hr', sort_order: sort_order ?? 99, ...done,
      })
      return { id: nd.id, ...done, candidateId }
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
      await updateDoc(doc(db, 'candidates', candidateId), {
        onboarding_status: 'completed', onboarding_progress: 100, completed_at: now(),
      })
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
      const docRef = await addDoc(collection(db, 'policy_sessions'), {
        candidate_id: candidateId || null, employee_id: employeeId || null, created_at: now(),
      })
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
        source_section: sourceSection || null, confidence: confidence || null,
        is_local: isLocal || false, created_at: now(),
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
    const unsubDocs   = onSnapshot(collection(db, 'documents'),
      () => queryClient.invalidateQueries({ queryKey: ['documents'] }))
    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), where('resolved', '==', false)),
      () => queryClient.invalidateQueries({ queryKey: ['alerts'] }))
    console.log('[realtime] Firebase listeners active')
    return () => { unsubCandidates(); unsubChecklist(); unsubDocs(); unsubAlerts() }
  }, [queryClient])
}