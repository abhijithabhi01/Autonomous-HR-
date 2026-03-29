import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import toast from 'react-hot-toast'

// ── API base URL ──────────────────────────────────────────────
// Local dev:   Vite proxy forwards /api/* → localhost:3001
// Production:  VITE_BACKEND_URL points to Render backend
const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const api  = (path) => BASE ? `${BASE}${path}` : path

async function apiFetch(path, options = {}) {
  const res = await fetch(api(path), {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  
  // Only try to parse if there is content in the response
  const text = await res.text();
  const data = text ? JSON.parse(text) : { error: 'Empty response from server' };
  
  if (!res.ok) {
    const err = Object.assign(
      new Error(data.error || `API error ${res.status}`),
      { status: res.status }
    );
    throw err;
  }
  return data;
}

// Returns true if React Query should NOT retry this error
function isNonRetryable(err) {
  // 503 = backend not ready (Firebase Admin not initialized)
  // 404 = resource genuinely missing
  // 409 = conflict (duplicate)
  return err?.status === 503 || err?.status === 404 || err?.status === 409
}

// ── Debounce (for realtime polling) ──────────────────────────
const _timers = {}
function debounce(key, fn, delay = 400) {
  clearTimeout(_timers[key])
  _timers[key] = setTimeout(fn, delay)
}

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

// ============================================================
// CANDIDATES
// ============================================================

export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn:  () => apiFetch('/api/candidates'),
    retry:    (count, err) => !isNonRetryable(err) && count < 2,
  })
}

export function useCandidate(id) {
  return useQuery({
    queryKey: ['candidate', id],
    enabled:  !!id,
    queryFn:  () => apiFetch(`/api/candidates/${id}`),
  })
}

export function useAddCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => apiFetch('/api/candidates', {
      method: 'POST',
      body:   JSON.stringify(fields),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })

      const authLine  = data.authCreated ? '✅ Login ready' : '⚠️ Auth creation failed'
      const emailLine = data.emailSent   ? `✉️  Email sent to ${data.loginEmail}` : '📋 Email not sent — share credentials manually'

      toast.success(
        `✅ ${data.full_name} added!\n\n` +
        `🔑 Login: ${data.loginEmail}\n` +
        `🔐 Password: ${data.tempPassword}\n` +
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
    mutationFn: (id) => apiFetch(`/api/candidates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning_requests'] })
      queryClient.invalidateQueries({ queryKey: ['checklist'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('🗑 Candidate and all related data removed')
    },
    onError: (err) => toast.error('Delete failed: ' + err.message),
  })
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }) => apiFetch(`/api/candidates/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(fields),
    }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', id] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
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
    queryFn:  () => apiFetch('/api/employees'),
  })
}

export function useEmployee(id) {
  return useQuery({
    queryKey: ['employee', id],
    enabled:  !!id,
    queryFn:  () => apiFetch(`/api/employees/${id}`),
  })
}

// ============================================================
// DOCUMENTS
// ============================================================

export function useDocuments(candidateId) {
  return useQuery({
    queryKey: ['documents', candidateId],
    enabled:  !!candidateId,
    queryFn:  async () => {
      const docs = await apiFetch(`/api/documents/${candidateId}`)
      return docs.map(addExpiryStatus)
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, docType, file, extractedData }) => {
      // Convert file to base64 in the browser, send to backend
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload  = e => resolve(e.target.result.split(',')[1])
        r.onerror = () => reject(new Error('Failed to read file'))
        r.readAsDataURL(file)
      })

      return apiFetch('/api/documents/upload', {
        method: 'POST',
        body:   JSON.stringify({
          candidateId, docType,
          base64, mimeType: file.type,
          fileName: file.name,
          extractedData: extractedData || null,
        }),
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', data.candidate_id] })
      // toast.success('Document uploaded successfully')
    },
    onError: (err) => toast.error(err.message),
  })
}

export async function getDocumentUrl(storagePath) {
  // download_url is stored directly on the document record
  return storagePath
}

// ============================================================
// CHECKLIST
// ============================================================

export function useChecklist(candidateId) {
  return useQuery({
    queryKey: ['checklist', candidateId],
    enabled:  !!candidateId,
    queryFn:  () => apiFetch(`/api/checklist/${candidateId}`),
  })
}

export function useToggleChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completed, candidateId }) =>
      apiFetch(`/api/checklist/${id}`, {
        method: 'PUT',
        body:   JSON.stringify({ completed, candidateId }),
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useCompleteChecklistByTitle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiFetch('/api/checklist/complete-by-title', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),
    onSuccess: (_, { candidateId }) => {
      if (!candidateId) return
      queryClient.invalidateQueries({ queryKey: ['checklist', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => console.warn('[useCompleteChecklistByTitle]', err.message),
  })
}

export function useMarkOnboardingComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (candidateId) => apiFetch(`/api/candidates/${candidateId}/complete-onboarding`, { method: 'PUT' }),
    onSuccess: (_, candidateId) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] })
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
    queryFn:  () => apiFetch('/api/alerts'),
    retry:    (count, err) => !isNonRetryable(err) && count < 2,
  })
}

export function useResolveAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (alertId) => apiFetch(`/api/alerts/${alertId}/resolve`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert resolved')
    },
    onError: (err) => toast.error(err.message),
  })
}

// ── Computed expiry alerts (mirrors Alerts.jsx logic) ────────

export function useExpiryAlerts() {
  const { data: candidates = [], isLoading: candLoading } = useCandidates()

  const docResults = useQueries({
    queries: candidates.map(c => ({
      queryKey: ['documents', c.id],
      queryFn:  async () => {
        const docs = await apiFetch(`/api/documents/${c.id}`)
        return docs.map(addExpiryStatus)
      },
      enabled: !!c.id,
    })),
  })

  const isLoading = candLoading || docResults.some(r => r.isLoading)

  const expiryAlerts = candidates.flatMap((c, i) => {
    const docs = docResults[i]?.data || []
    return docs
      .filter(d => {
        if (!d.expiry_date) return false
        const days = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000)
        return days <= 90
      })
      .map(doc => {
        const days     = Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000)
        const severity = days < 0 ? 'high' : days < 30 ? 'high' : 'medium'
        const docLabel = doc.label && doc.label !== doc.doc_type
          ? doc.label
          : doc.doc_type
            ? doc.doc_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            : 'Document'
        const message = days < 0
          ? `${docLabel} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
          : `${docLabel} expires in ${days} day${days === 1 ? '' : 's'}`
        return {
          id:          `doc_${c.id}_${doc.id}`,
          type:        'expiry',
          severity,
          person_name: c.full_name,
          message,
        }
      })
  })

  return { data: expiryAlerts, isLoading }
}


// ── Deadline alerts: start_date ≤ 2 days away & onboarding incomplete ──
// start_date in this system is the LAST DATE to submit documents.
// Raises alerts when: days_remaining ≤ 2 AND progress < 100.
// Also raises overdue alerts when deadline has already passed.
export function useDeadlineAlerts() {
  const { data: candidates = [], isLoading } = useCandidates()

  const deadlineAlerts = candidates
    .filter(c => c.start_date && (c.onboarding_progress ?? 0) < 100)
    .flatMap(c => {
      const daysLeft = Math.ceil((new Date(c.start_date) - new Date()) / 86400000)
      if (daysLeft > 2) return []   // plenty of time — no alert

      const isOverdue  = daysLeft < 0
      const isToday    = daysLeft === 0
      const severity   = isOverdue || isToday ? 'high' : 'high'  // always high within 2 days
      const progress   = c.onboarding_progress ?? 0

      const message = isOverdue
        ? `Onboarding deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago — only ${progress}% complete`
        : isToday
          ? `Onboarding deadline is TODAY — only ${progress}% complete`
          : `Onboarding deadline in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — only ${progress}% complete`

      return [{
        id:          `deadline_${c.id}`,
        type:        'deadline',
        severity,
        person_name: c.full_name,
        candidate_id: c.id,
        message,
        daysLeft,
        progress,
        start_date:  c.start_date,
      }]
    })

  return { data: deadlineAlerts, isLoading }
}

// ============================================================
// PROVISIONING
// ============================================================

export function useProvisioningRequests() {
  return useQuery({
    queryKey: ['provisioning_requests'],
    queryFn:  () => apiFetch('/api/provisioning'),
  })
}

export function useUpdateProvisioning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }) => apiFetch(`/api/provisioning/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(patch),
    }),
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
    mutationFn: (data) => apiFetch('/api/policy/session', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policy_sessions'] }),
  })
}

export function useAddPolicyMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiFetch('/api/policy/message', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ['policy_messages', data.session_id] }),
  })
}

// ============================================================
// REALTIME SYNC
// ============================================================
// Without Firebase client SDK there are no WebSocket listeners.
// We poll every 10s as a lightweight replacement — good enough
// for an onboarding app where real-time is nice-to-have, not critical.
// For true real-time, a WebSocket layer can be added to the backend later.
// ─────────────────────────────────────────────────────────────
export function useRealtimeSync({ pausePolling = false } = {}) {
  const queryClient    = useQueryClient()
  // Keep a ref so the interval callback always sees the latest value
  // without needing to be recreated every time pausePolling changes.
  const pauseRef = useRef(pausePolling)
  useEffect(() => { pauseRef.current = pausePolling }, [pausePolling])

  useEffect(() => {
    let consecutiveFailures = 0

    const poll = async () => {
      // Skip invalidation while any modal is open — prevents mid-form refetches
      if (pauseRef.current) {
        console.log('[realtime] Polling paused (modal open) — skipping invalidation')
        return
      }

      // Check backend health before invalidating — avoids flicker on 503
      try {
        const base     = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
        const endpoint = base ? `${base}/api/health` : '/api/health'
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) {
          consecutiveFailures++
          console.warn(`[realtime] Backend unhealthy (${res.status}) — skipping invalidation`)
          return
        }
        consecutiveFailures = 0
      } catch {
        consecutiveFailures++
        // Backend unreachable — skip silently (no error toast, no flicker)
        return
      }

      debounce('poll', () => {
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
      })
    }

    // Poll every 30s (was 10s) — only after health check passes
    const interval = setInterval(poll, 30000)
    console.log('[realtime] Polling mode active (30s, health-gated)')

    return () => {
      clearInterval(interval)
      Object.keys(_timers).forEach(k => { clearTimeout(_timers[k]); delete _timers[k] })
    }
  }, [queryClient])
}

// ── Checklist cleanup (removes stale items like Team Introduction, Day 7 Check-in) ──
export function useCleanupChecklistTitles() {
  return useMutation({
    mutationFn: (titles) => apiFetch('/api/checklist/cleanup-titles', {
      method: 'DELETE',
      body:   JSON.stringify({ titles }),
    }),
    onSuccess: (data) => {
      if (data.deleted > 0) console.log(`[cleanup] Removed ${data.deleted} stale checklist items`)
    },
    onError: (err) => console.warn('[cleanup] Checklist cleanup failed:', err.message),
  })
}

// ── Admin account creation ────────────────────────────────────
export function useCreateITAdmin() {
  return useMutation({
    mutationFn: ({ name, email, password }) => apiFetch('/api/auth/create-it-admin', {
      method: 'POST',
      body:   JSON.stringify({ name, email, password }),
    }),
  })
}

export function useCreateHRAdmin() {
  return useMutation({
    mutationFn: ({ name, email, password }) => apiFetch('/api/auth/create-hr-admin', {
      method: 'POST',
      body:   JSON.stringify({ name, email, password }),
    }),
  })
}
// ── Final Submit — candidate finalises onboarding ─────────────
// Calls POST /api/candidates/:id/final-submit which:
//   • Auto-ticks "ID Card Issued" checklist item
//   • Sends ID card + completion email to personal email
//   • Sets final_submitted_at on the candidate doc
export function useFinalSubmitOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (candidateId) => apiFetch(`/api/candidates/${candidateId}/final-submit`, {
      method: 'POST',
    }),
    onSuccess: (_, candidateId) => {
      queryClient.invalidateQueries({ queryKey: ['checklist', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (err) => console.warn('[useFinalSubmitOnboarding]', err.message),
  })
}