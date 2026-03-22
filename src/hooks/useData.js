// src/hooks/useData.js
// All data operations go through the backend API.
// No Firebase SDK imports — Firebase lives entirely on the backend.

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

// ── API base URL ──────────────────────────────────────────────
// Local dev:   Vite proxy forwards /api/* → localhost:3001
// Production:  VITE_BACKEND_URL points to Render backend
const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const api  = (path) => BASE ? `${BASE}${path}` : path

async function apiFetch(path, options = {}) {
  const res  = await fetch(api(path), {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json().catch(() => ({ error: 'No response body' }))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
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
        `📧 Work email: ${data.workEmail}\n\n` +
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
      toast.success('Document uploaded successfully')
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
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const interval = setInterval(() => {
      debounce('poll', () => {
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
      })
    }, 10000)  // poll every 10 seconds

    console.log('[realtime] Polling mode active (10s interval)')
    return () => {
      clearInterval(interval)
      Object.keys(_timers).forEach(k => { clearTimeout(_timers[k]); delete _timers[k] })
    }
  }, [queryClient])
}