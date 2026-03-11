import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchEmployee(id) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Create a new candidate/employee.
 * Also:
 *   • creates a Supabase auth account (email + temp password)
 *   • creates a profiles row so they can log in
 *   • creates an IT provisioning request
 *
 * Returns { employee, loginEmail, tempPassword }
 */
export async function createEmployee(fields) {
  const id     = fields.id || `EMP-${Date.now()}`
  const avatar = fields.avatar || fields.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // ── 1. Generate temp credentials ────────────────────────────
  const tempPassword = `Welcome${Math.floor(1000 + Math.random() * 9000)}!`
  const loginEmail   = fields.personal_email || fields.email

  // ── 2. Create auth user (non-fatal if it fails) ─────────────
  let authUserId = null
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    loginEmail,
      password: tempPassword,
      options: {
        data: { name: fields.full_name, role: 'employee' },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })
    if (!authError && authData?.user) {
      authUserId = authData.user.id
      // ── 3. Create profile row ─────────────────────────────────
      await supabase.from('profiles').insert({
        id:          authUserId,
        email:       loginEmail,
        name:        fields.full_name,
        role:        'employee',
        avatar,
        employee_id: id,
      })
    }
  } catch (err) {
    console.warn('[api.createEmployee] Auth creation failed (non-fatal):', err.message)
  }

  // ── 4. Insert employee row ───────────────────────────────────
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .insert({
      id,
      avatar,
      status:              fields.status || 'pre_joining',
      onboarding_progress: 0,
      ...fields,
    })
    .select()
    .single()
  if (empError) throw empError

  // ── 5. Create IT provisioning request ───────────────────────
  await supabase.from('provisioning_requests').insert({
    employee_id:         employee.id,
    candidate_name:      employee.full_name,
    email:               employee.email,
    position:            employee.position,
    department:          employee.department,
    manager:             employee.manager    || null,
    location:            employee.location   || null,
    start_date:          employee.start_date || null,
    status:              'pending',
    systems_provisioned: {},
  })
  // Provisioning failure is non-fatal

  return { employee, loginEmail, tempPassword }
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) throw error
  return id
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchDocuments(employeeId) {
  const { data, error } = await supabase
    .from('documents_with_expiry')
    .select('*')
    .eq('employee_id', employeeId)
    .order('type')
  if (error) throw error
  return data
}

export async function uploadDocument({ employeeId, docType, file, extractedData }) {
  const ext  = file.name.split('.').pop()
  const path = `${employeeId}/${docType}_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documents')
    .upsert({
      employee_id:    employeeId,
      type:           docType,
      label:          labelForType(docType),
      icon:           iconForType(docType),
      status:         extractedData ? 'verified' : 'uploaded',
      uploaded_at:    new Date().toISOString(),
      storage_path:   path,
      extracted_data: extractedData ?? null,
      expiry_date:    extractedData?.expiry_date ?? null,
    }, { onConflict: 'employee_id,type' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDocumentSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 5)
  if (error) throw error
  return data.signedUrl
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchChecklist(employeeId) {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('employee_id', employeeId)
    .order('sort_order')
  if (error) throw error
  return data
}

export async function toggleChecklistItem({ id, completed, employeeId }) {
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
  return { ...data, employeeId }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('resolved', false)
    .order('severity',   { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function resolveAlert(alertId) {
  const { error } = await supabase
    .from('alerts')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alertId)
  if (error) throw error
  return alertId
}

// ═══════════════════════════════════════════════════════════════════════════
// POLICY QUERIES LOG
// ═══════════════════════════════════════════════════════════════════════════

export async function logPolicyQuery({ employeeId, question, answer, source, confidence }) {
  const { error } = await supabase.from('policy_queries').insert({
    employee_id: employeeId,
    question,
    answer,
    source,
    confidence,
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════════
// IT PROVISIONING
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchProvisioningRequests() {
  const { data, error } = await supabase
    .from('provisioning_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateProvisioningRequest({ id, ...patch }) {
  const { error } = await supabase
    .from('provisioning_requests')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILES (auth helpers)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function labelForType(type) {
  return {
    passport:          'Passport',
    visa:              'Visa / Work Permit',
    degree:            'Degree Certificate',
    employment_letter: 'Employment Letter',
    bank_details:      'Bank Details',
  }[type] ?? type
}

function iconForType(type) {
  return {
    passport:          '🛂',
    visa:              '📋',
    degree:            '🎓',
    employment_letter: '📄',
    bank_details:      '🏦',
  }[type] ?? '📁'
}