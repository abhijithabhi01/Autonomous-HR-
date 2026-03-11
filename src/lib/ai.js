// src/lib/ai.js
// OpenRouter AI client — handles policy Q&A, document verification, and expiry checks.
// Set VITE_OPENROUTER_API_KEY in .env.local (free at openrouter.ai)
//
// Free models used:
//   Text   → meta-llama/llama-3.3-70b-instruct:free
//   Vision → meta-llama/llama-4-scout-17b-16e-instruct:free  (latest free vision model)
//
// All exported functions are SAFE — they never throw. Always return a usable value.

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const BASE_URL       = 'https://openrouter.ai/api/v1/chat/completions'
const TEXT_MODEL     = 'meta-llama/llama-3.3-70b-instruct:free'
const VISION_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct:free'

// ── Core OpenRouter fetch ─────────────────────────────────────
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
    throw new Error(err?.error?.message || `OpenRouter HTTP ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from model')
  return text
}

// ── JSON extractor — handles markdown fences and surrounding text ──
function safeParseJSON(raw) {
  if (!raw) return null
  // Strip markdown fences
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  // Try direct parse first
  try { return JSON.parse(s) } catch {}
  // Extract first {...} block
  const m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

// ── Text helper ───────────────────────────────────────────────
export async function callAI(prompt) {
  return openRouterRequest(TEXT_MODEL, [{ role: 'user', content: prompt }])
}

// ── Vision helper ─────────────────────────────────────────────
export async function callAIVision(base64Image, mimeType, prompt) {
  return openRouterRequest(VISION_MODEL, [{
    role:    'user',
    content: [
      { type: 'text',      text: prompt },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
    ],
  }], 0.1)
}

// ── Document Verification ─────────────────────────────────────
// Sends document image to vision model, extracts structured data.
// Never throws — returns partial data with a note on failure.
export async function verifyDocument(base64, mimeType, documentType) {
  const prompts = {
    passport: `Analyze this passport image carefully. Return ONLY a raw JSON object with no markdown:
{"name":"","passport_number":"","date_of_birth":"YYYY-MM-DD","nationality":"","expiry_date":"YYYY-MM-DD","is_authentic":true,"confidence":95,"days_until_expiry":0,"flags":[]}`,
    visa: `Analyze this visa or work permit. Return ONLY raw JSON:
{"visa_type":"","expiry_date":"YYYY-MM-DD","country":"","permitted_activities":"","holder_name":"","is_authentic":true,"confidence":90,"days_until_expiry":0,"flags":[]}`,
    degree: `Analyze this academic certificate or degree. Return ONLY raw JSON:
{"institution":"","degree":"","field_of_study":"","graduation_year":"","student_name":"","is_authentic":true,"confidence":88,"flags":[]}`,
    employment_letter: `Analyze this employment letter or offer letter. Return ONLY raw JSON:
{"company":"","position":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD or null","employee_name":"","is_authentic":true,"confidence":85,"flags":[]}`,
    bank_details: `Analyze this bank document or account statement. Return ONLY raw JSON:
{"bank_name":"","account_holder":"","account_type":"","iban_last4":"","is_authentic":true,"confidence":90,"flags":[]}`,
  }

  try {
    const raw    = await callAIVision(base64, mimeType, prompts[documentType] || prompts.passport)
    const parsed = safeParseJSON(raw)
    if (parsed) return parsed
    throw new Error('Could not parse AI response')
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
// Takes an expiry date string, returns structured risk assessment.
// Never throws.
export async function checkDocumentExpiry(expiryDateStr, documentType = 'document') {
  if (!expiryDateStr) return { status: 'unknown', days_remaining: null, message: 'No expiry date provided' }

  const expiry  = new Date(expiryDateStr)
  const today   = new Date()
  const diffMs  = expiry - today
  const days    = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  // Compute locally first — AI is just for the message
  const status =
    days < 0   ? 'expired' :
    days < 30  ? 'critical' :
    days < 90  ? 'warning' :
    days < 180 ? 'notice' : 'ok'

  if (!OPENROUTER_KEY) {
    const msgs = {
      expired:  `${documentType} expired ${Math.abs(days)} days ago. Immediate renewal required.`,
      critical: `${documentType} expires in ${days} days. Urgent renewal needed.`,
      warning:  `${documentType} expires in ${days} days. Renewal recommended soon.`,
      notice:   `${documentType} expires in ${days} days. Plan renewal within 3 months.`,
      ok:       `${documentType} is valid for ${days} more days.`,
    }
    return { status, days_remaining: days, message: msgs[status] }
  }

  try {
    const prompt = `A ${documentType} expires on ${expiryDateStr}. Today is ${today.toISOString().slice(0,10)}.
Days remaining: ${days}.

Write a 1-sentence HR alert message about this expiry status.
Return ONLY raw JSON: {"status":"${status}","days_remaining":${days},"message":"your message here","action_required":${days < 90}}`

    const raw    = await callAI(prompt)
    const parsed = safeParseJSON(raw)
    if (parsed?.message) return parsed
    return { status, days_remaining: days, message: `${documentType} has ${days} days remaining.` }
  } catch (err) {
    console.warn('[checkDocumentExpiry] AI failed:', err.message)
    return { status, days_remaining: days, message: `${documentType} expires in ${days} days.` }
  }
}

// ── Policy Q&A ────────────────────────────────────────────────
// Answers HR policy questions. Never throws.
// Falls back to local keyword search if OpenRouter is unavailable.
export async function answerPolicyQuestion(question, policyContext) {
  // ── Try OpenRouter first ──
  if (OPENROUTER_KEY) {
    try {
      const prompt = `You are a helpful HR Policy Assistant for a company. Answer the employee's question using ONLY the policy context provided below. Be concise (2-3 sentences max). If not covered, say so and recommend contacting HR.

COMPANY POLICY:
${policyContext}

EMPLOYEE QUESTION: ${question}

Return ONLY a raw JSON object with no markdown fences or extra text:
{"answer":"your answer here","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}`

      const raw    = await callAI(prompt)
      const parsed = safeParseJSON(raw)

      if (parsed?.answer) {
        return {
          answer:         parsed.answer,
          source_section: parsed.source_section || null,
          confidence:     parsed.confidence     || 85,
          is_local:       false,
        }
      }

      // Model returned plain text — wrap it
      if (raw?.trim().length > 10) {
        return {
          answer:         raw.trim().slice(0, 600),
          source_section: 'Company Policy',
          confidence:     70,
          is_local:       false,
        }
      }
    } catch (err) {
      console.warn('[PolicyBot] OpenRouter failed, using local fallback:', err.message)
    }
  }

  // ── Local keyword fallback — always works ──
  return localPolicySearch(question, policyContext)
}

// ── Local keyword search fallback ────────────────────────────
export function localPolicySearch(question, policyContext) {
  const q = question.toLowerCase()

  const SECTIONS = [
    { keys: ['annual leave', 'vacation', 'holiday', 'days off', 'pto', 'time off'],   section: 'LEAVE POLICY' },
    { keys: ['sick', 'medical', 'ill', 'unwell'],                                      section: 'LEAVE POLICY' },
    { keys: ['maternity', 'paternity', 'parental', 'baby'],                            section: 'LEAVE POLICY' },
    { keys: ['remote', 'work from home', 'wfh', 'hybrid'],                            section: 'REMOTE WORK POLICY' },
    { keys: ['travel', 'expense', 'receipt', 'flight', 'reimburse'],                  section: 'TRAVEL AND EXPENSES POLICY' },
    { keys: ['laptop', 'equipment', 'device', 'vpn', 'software', 'it setup'],        section: 'IT AND EQUIPMENT POLICY' },
    { keys: ['probation', 'trial period', 'notice', 'resignation'],                   section: 'PROBATION POLICY' },
    { keys: ['salary', 'pay', 'payroll', 'wage', 'bonus', 'increment', 'increment'],  section: 'SALARY AND PAYROLL' },
  ]

  const match = SECTIONS.find(s => s.keys.some(k => q.includes(k)))
  if (!match) {
    return {
      answer:         "I couldn't find specific information about that in the policy. Please contact HR directly at hr@company.com for help.",
      source_section: null,
      confidence:     40,
      is_local:       true,
    }
  }

  const lines = policyContext.split('\n').map(l => l.trim()).filter(Boolean)
  let capturing = false
  const bullets  = []

  for (const line of lines) {
    if (line.includes(match.section)) { capturing = true; continue }
    if (capturing) {
      if (line.endsWith(':') && line === line.toUpperCase()) break // next section header
      if (line.startsWith('-')) bullets.push(line)
      if (bullets.length >= 4) break
    }
  }

  if (bullets.length === 0) {
    return {
      answer:         `I found the ${match.section.toLowerCase()} section but couldn't extract the details. Please contact HR at hr@company.com.`,
      source_section: match.section,
      confidence:     60,
      is_local:       true,
    }
  }

  return {
    answer:         bullets.join('\n'),
    source_section: match.section,
    confidence:     80,
    is_local:       true,
  }
}

// ── Legacy aliases (for any imports that still use the old names) ──
export { callAI as callGemini, callAIVision as callGeminiVision }