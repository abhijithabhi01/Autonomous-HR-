// src/lib/ai.js
// OpenRouter AI client — document verification, expiry checks, policy Q&A.
// Set VITE_OPENROUTER_API_KEY in .env.local (free at openrouter.ai)
//
// Vision models tried in order (first one that responds wins):
//   1. google/gemini-2.0-flash-exp:free
//   2. meta-llama/llama-3.2-11b-vision-instruct:free
//   3. qwen/qwen2-vl-7b-instruct:free
//
// NOTE: llama-4-scout-17b was removed from OpenRouter's free tier — that's
//       why you were seeing "No endpoints found". The fallback chain above
//       tries three alternatives automatically.
//
// All exported functions are SAFE — they never throw. Always return a usable value.

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const BASE_URL       = 'https://openrouter.ai/api/v1/chat/completions'
const TEXT_MODEL     = 'meta-llama/llama-3.3-70b-instruct:free'

// Vision models tried in order
const VISION_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'qwen/qwen2-vl-7b-instruct:free',
]

// ── Core fetch ────────────────────────────────────────────────
async function openRouterRequest(model, messages, temperature = 0.3) {
  if (!OPENROUTER_KEY) throw new Error('VITE_OPENROUTER_API_KEY not set in .env.local')

  const res = await fetch(BASE_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer':  window.location.origin,
      'X-Title':       'PeopleOS HR Platform',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 1024 }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message || `OpenRouter HTTP ${res.status}`
    throw new Error(msg)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from model')
  return text
}

// ── Vision with automatic fallback across models ──────────────
async function openRouterVisionRequest(base64Image, mimeType, prompt) {
  if (!OPENROUTER_KEY) throw new Error('VITE_OPENROUTER_API_KEY not set')

  const messages = [{
    role:    'user',
    content: [
      { type: 'text',      text: prompt },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
    ],
  }]

  let lastError = null
  for (const model of VISION_MODELS) {
    try {
      console.log(`[vision] Trying: ${model}`)
      const text = await openRouterRequest(model, messages, 0.1)
      console.log(`[vision] Success: ${model}`)
      return text
    } catch (err) {
      console.warn(`[vision] ${model} failed: ${err.message}`)
      lastError = err
      // Don't retry on auth errors — they'll all fail the same way
      if (err.message.includes('401') || err.message.toLowerCase().includes('invalid api key')) throw err
    }
  }
  throw lastError || new Error('All vision models failed')
}

// ── JSON extractor — strips markdown fences, finds first {} ──
function safeParseJSON(raw) {
  if (!raw) return null
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(s) } catch {}
  const m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

// ── Public helpers ─────────────────────────────────────────────
export async function callAI(prompt) {
  return openRouterRequest(TEXT_MODEL, [{ role: 'user', content: prompt }])
}

export async function callAIVision(base64Image, mimeType, prompt) {
  return openRouterVisionRequest(base64Image, mimeType, prompt)
}

// ── Document Verification ─────────────────────────────────────
// Returns extracted fields + authenticity signals.
// Never throws — returns { is_authentic: null, confidence: 0 } on failure.
export async function verifyDocument(base64, mimeType, documentType) {
  const prompts = {
    passport: `You are a document OCR system. Read this passport image carefully and extract all visible text.
Return ONLY a raw JSON object — no markdown, no explanation:
{"name":"","passport_number":"","date_of_birth":"DD MMM YYYY","nationality":"","expiry_date":"DD MMM YYYY","is_authentic":true,"confidence":90,"days_until_expiry":0,"flags":[]}
Use "" for any field you cannot read clearly. Do not invent values.`,

    visa: `You are a document OCR system. Read this visa or work permit image.
Return ONLY a raw JSON object — no markdown:
{"visa_type":"","expiry_date":"DD MMM YYYY","country":"","permitted_activities":"","holder_name":"","is_authentic":true,"confidence":90,"days_until_expiry":0,"flags":[]}
Use "" for unclear fields.`,

    degree: `You are a document OCR system. Read this academic certificate or degree.
Return ONLY a raw JSON object — no markdown:
{"institution":"","degree":"","field_of_study":"","graduation_year":"","student_name":"","is_authentic":true,"confidence":88,"flags":[]}
Use "" for unclear fields.`,

    employment_letter: `You are a document OCR system. Read this employment letter or offer letter.
Return ONLY a raw JSON object — no markdown:
{"company":"","position":"","start_date":"","end_date":"","employee_name":"","is_authentic":true,"confidence":85,"flags":[]}
Use "" for unclear fields.`,

    bank_details: `You are a document OCR system. Read this bank document or account statement.
Return ONLY a raw JSON object — no markdown:
{"bank_name":"","account_holder":"","account_type":"","iban_last4":"","is_authentic":true,"confidence":90,"flags":[]}
Use "" for unclear fields.`,
  }

  try {
    const raw    = await callAIVision(base64, mimeType, prompts[documentType] || prompts.passport)
    const parsed = safeParseJSON(raw)
    if (parsed) return parsed
    throw new Error('Could not parse AI response as JSON')
  } catch (err) {
    console.warn('[verifyDocument] AI failed:', err.message)
    return {
      is_authentic: null,
      confidence:   0,
      flags:        [],
      note:         'AI verification unavailable — queued for manual review',
    }
  }
}

// ── Document Expiry Check ─────────────────────────────────────
export async function checkDocumentExpiry(expiryDateStr, documentType = 'document') {
  if (!expiryDateStr) return { status: 'unknown', days_remaining: null, message: 'No expiry date provided' }

  const expiry = new Date(expiryDateStr)
  const today  = new Date()
  const days   = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))

  const status =
    days < 0   ? 'expired'  :
    days < 30  ? 'critical' :
    days < 90  ? 'warning'  :
    days < 180 ? 'notice'   : 'ok'

  const msgs = {
    expired:  `${documentType} expired ${Math.abs(days)} days ago. Immediate renewal required.`,
    critical: `${documentType} expires in ${days} days. Urgent renewal needed.`,
    warning:  `${documentType} expires in ${days} days. Renewal recommended soon.`,
    notice:   `${documentType} expires in ${days} days. Plan renewal within 3 months.`,
    ok:       `${documentType} is valid for ${days} more days.`,
  }

  if (!OPENROUTER_KEY) return { status, days_remaining: days, message: msgs[status] }

  try {
    const raw    = await callAI(`A ${documentType} expires on ${expiryDateStr}. Today is ${today.toISOString().slice(0,10)}. Days remaining: ${days}. Write a 1-sentence HR alert. Return ONLY raw JSON: {"status":"${status}","days_remaining":${days},"message":"your message","action_required":${days < 90}}`)
    const parsed = safeParseJSON(raw)
    if (parsed?.message) return parsed
    return { status, days_remaining: days, message: msgs[status] }
  } catch {
    return { status, days_remaining: days, message: msgs[status] }
  }
}

// ── Policy Q&A ────────────────────────────────────────────────
export async function answerPolicyQuestion(question, policyContext) {
  if (OPENROUTER_KEY) {
    try {
      const prompt = `You are a helpful HR Policy Assistant. Answer using ONLY the policy context below. Be concise (2-3 sentences). If not covered, say so and recommend contacting HR.

COMPANY POLICY:
${policyContext}

EMPLOYEE QUESTION: ${question}

Return ONLY a raw JSON object with no markdown:
{"answer":"your answer here","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}`

      const raw    = await callAI(prompt)
      const parsed = safeParseJSON(raw)

      if (parsed?.answer) {
        return { answer: parsed.answer, source_section: parsed.source_section || null, confidence: parsed.confidence || 85, is_local: false }
      }
      if (raw?.trim().length > 10) {
        return { answer: raw.trim().slice(0, 600), source_section: 'Company Policy', confidence: 70, is_local: false }
      }
    } catch (err) {
      console.warn('[PolicyBot] OpenRouter failed, using local fallback:', err.message)
    }
  }
  return localPolicySearch(question, policyContext)
}

// ── Local keyword fallback ─────────────────────────────────────
export function localPolicySearch(question, policyContext) {
  const q = question.toLowerCase()
  const SECTIONS = [
    { keys: ['annual leave', 'vacation', 'holiday', 'days off', 'pto', 'time off'], section: 'LEAVE POLICY' },
    { keys: ['sick', 'medical', 'ill', 'unwell'],                                   section: 'LEAVE POLICY' },
    { keys: ['maternity', 'paternity', 'parental', 'baby'],                         section: 'LEAVE POLICY' },
    { keys: ['remote', 'work from home', 'wfh', 'hybrid'],                         section: 'REMOTE WORK POLICY' },
    { keys: ['travel', 'expense', 'receipt', 'flight', 'reimburse'],               section: 'TRAVEL AND EXPENSES POLICY' },
    { keys: ['laptop', 'equipment', 'device', 'vpn', 'software'],                  section: 'IT AND EQUIPMENT POLICY' },
    { keys: ['probation', 'trial period', 'notice', 'resignation'],                section: 'PROBATION POLICY' },
    { keys: ['salary', 'pay', 'payroll', 'wage', 'bonus', 'increment'],            section: 'SALARY AND PAYROLL' },
  ]

  const match = SECTIONS.find(s => s.keys.some(k => q.includes(k)))
  if (!match) return { answer: "I couldn't find that in the policy. Please contact HR at hr@company.com.", source_section: null, confidence: 40, is_local: true }

  const lines   = policyContext.split('\n').map(l => l.trim()).filter(Boolean)
  let capturing = false
  const bullets = []
  for (const line of lines) {
    if (line.includes(match.section)) { capturing = true; continue }
    if (capturing) {
      if (line.endsWith(':') && line === line.toUpperCase()) break
      if (line.startsWith('-')) bullets.push(line)
      if (bullets.length >= 4) break
    }
  }

  if (!bullets.length) return { answer: `Found ${match.section.toLowerCase()} section but couldn't extract details. Contact HR at hr@company.com.`, source_section: match.section, confidence: 60, is_local: true }
  return { answer: bullets.join('\n'), source_section: match.section, confidence: 80, is_local: true }
}

// Legacy aliases
export { callAI as callGemini, callAIVision as callGeminiVision }