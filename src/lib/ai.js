// src/lib/ai.js
// OpenRouter AI  -  OCR, expiry checks, policy Q&A
// Set VITE_OPENROUTER_API_KEY in .env then restart dev server

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const BASE_URL       = 'https://openrouter.ai/api/v1/chat/completions'
const TEXT_MODEL     = 'meta-llama/llama-3.3-70b-instruct:free'
const VISION_MODEL   = 'google/gemma-3-12b-it:free'

// Startup check  -  shows in browser console on every page load
;(function checkKey() {
  if (!OPENROUTER_KEY) {
    console.error(
      '[ai.js] VITE_OPENROUTER_API_KEY is not set!\n' +
      'Fix: add VITE_OPENROUTER_API_KEY=sk-or-v1-... to your .env file, then restart: npm run dev'
    )
  } else {
    console.log('[ai.js] OpenRouter key loaded:', OPENROUTER_KEY.slice(0, 12) + '...')
  }
})()

// --- Core fetch ---
async function openRouterRequest(model, messages, temperature, maxTokens) {
  temperature = temperature ?? 0.3
  maxTokens   = maxTokens   ?? 1024

  if (!OPENROUTER_KEY) throw new Error('VITE_OPENROUTER_API_KEY not set')

  const res = await fetch(BASE_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'HTTP-Referer':  window.location.origin,
      'X-Title':       'PeopleOS HR Platform',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg = (errBody && errBody.error && errBody.error.message) || ('HTTP ' + res.status)
    console.error('[openRouter]', model, '->', res.status, msg)
    throw new Error(msg)
  }

  const data = await res.json()
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || null
  if (!text) {
    console.error('[openRouter]', model, 'returned no content:', JSON.stringify(data).slice(0, 200))
    throw new Error('Model returned empty content')
  }
  return text
}

// --- JSON extractor ---
function safeParseJSON(raw) {
  if (!raw) return null
  let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(s) } catch (_) {}
  const m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (_) {} }
  return null
}

// --- Public: text ---
export async function callAI(prompt) {
  return openRouterRequest(TEXT_MODEL, [{ role: 'user', content: prompt }])
}

// --- Public: vision ---
export async function callAIVision(base64Image, mimeType, prompt) {
  const messages = [{
    role: 'user',
    content: [
      { type: 'text',      text: prompt },
      { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Image } },
    ],
  }]
  return openRouterRequest(VISION_MODEL, messages, 0.1, 600)
}

// --- Document Verification ---
export async function verifyDocument(base64, mimeType, documentType) {
  if (mimeType === 'application/pdf') {
    return {
      is_authentic: null,
      confidence:   0,
      flags:        ['PDF uploaded'],
      note:         'PDF saved. Upload a JPG or PNG screenshot to enable AI field extraction.',
    }
  }

  if (!OPENROUTER_KEY) {
    return {
      is_authentic: null,
      confidence:   0,
      flags:        [],
      note:         'VITE_OPENROUTER_API_KEY not set. Add it to .env and restart the dev server.',
    }
  }

  const TEMPLATES = {
    passport:          '{"name":"","passport_number":"","date_of_birth":"","nationality":"","expiry_date":"","is_authentic":true,"confidence":90,"flags":[]}',
    visa:              '{"visa_type":"","holder_name":"","country":"","expiry_date":"","permitted_activities":"","is_authentic":true,"confidence":90,"flags":[]}',
    degree:            '{"student_name":"","institution":"","degree":"","field_of_study":"","graduation_year":"","is_authentic":true,"confidence":88,"flags":[]}',
    employment_letter: '{"employee_name":"","company":"","position":"","start_date":"","end_date":"","is_authentic":true,"confidence":85,"flags":[]}',
    bank_details:      '{"account_holder":"","bank_name":"","account_type":"","account_number":"","ifsc_code":"","is_authentic":true,"confidence":90,"flags":[]}',
    aadhaar:           '{"name":"","aadhaar_number":"","date_of_birth":"","gender":"","address":"","is_authentic":true,"confidence":90,"flags":[]}',
    pan_card:          '{"name":"","pan_number":"","father_name":"","date_of_birth":"","is_authentic":true,"confidence":90,"flags":[]}',
  }

  const template = TEMPLATES[documentType] || TEMPLATES.passport
  const prompt   = 'You are an OCR system. Extract all visible text from this document image and return ONLY a JSON object matching this exact structure - no markdown, no explanation:\n' + template + '\nFill every field you can read. Use empty string "" for any field you cannot read clearly.'

  const messages = [{
    role: 'user',
    content: [
      { type: 'text',      text: prompt },
      { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } },
    ],
  }]

  try {
    console.log('[OCR] Calling', VISION_MODEL, 'for', documentType)
    const raw    = await openRouterRequest(VISION_MODEL, messages, 0.1, 600)
    console.log('[OCR] Raw response:', raw.slice(0, 300))
    const parsed = safeParseJSON(raw)
    if (parsed) {
      const filled = Object.keys(parsed).filter(function(k) {
        const v = parsed[k]
        return v && v !== true && !Array.isArray(v)
      })
      console.log('[OCR] Extracted fields:', filled)
      return parsed
    }
    throw new Error('Response was not valid JSON: ' + raw.slice(0, 100))
  } catch (err) {
    console.error('[OCR] Failed:', err.message)
    return {
      is_authentic: null,
      confidence:   0,
      flags:        ['OCR failed'],
      note:         'AI extraction failed: ' + err.message + '. Fill in the fields manually - your document is saved.',
    }
  }
}

// --- Document Expiry Check ---
export async function checkDocumentExpiry(expiryDateStr, documentType) {
  documentType = documentType || 'document'
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
    expired:  documentType + ' expired ' + Math.abs(days) + ' days ago. Immediate renewal required.',
    critical: documentType + ' expires in ' + days + ' days. Urgent renewal needed.',
    warning:  documentType + ' expires in ' + days + ' days. Renewal recommended soon.',
    notice:   documentType + ' expires in ' + days + ' days. Plan renewal within 3 months.',
    ok:       documentType + ' is valid for ' + days + ' more days.',
  }

  if (!OPENROUTER_KEY) return { status, days_remaining: days, message: msgs[status] }

  try {
    const prompt = 'A ' + documentType + ' expires on ' + expiryDateStr + '. Today is ' + today.toISOString().slice(0,10) + '. Days remaining: ' + days + '. Write a 1-sentence HR alert. Return ONLY raw JSON: {"status":"' + status + '","days_remaining":' + days + ',"message":"your message","action_required":' + (days < 90) + '}'
    const raw    = await callAI(prompt)
    const parsed = safeParseJSON(raw)
    if (parsed && parsed.message) return parsed
    return { status, days_remaining: days, message: msgs[status] }
  } catch (_) {
    return { status, days_remaining: days, message: msgs[status] }
  }
}

// --- Policy Q&A ---
export async function answerPolicyQuestion(question, policyContext) {
  console.log('[PolicyBot] Key present:', !!OPENROUTER_KEY, '| Model:', TEXT_MODEL)

  if (!OPENROUTER_KEY) {
    console.warn('[PolicyBot] No API key - using local fallback. Set VITE_OPENROUTER_API_KEY in .env and restart.')
    return localPolicySearch(question, policyContext)
  }

  try {
    const prompt =
      'You are a helpful HR Policy Assistant. Answer using ONLY the policy context below. ' +
      'Be concise (2-3 sentences max). If not covered, say so and suggest contacting HR at hr@company.com.\n\n' +
      'COMPANY POLICY:\n' + policyContext + '\n\n' +
      'EMPLOYEE QUESTION: ' + question + '\n\n' +
      'Return ONLY a raw JSON object - no markdown, no extra text:\n' +
      '{"answer":"your answer here","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}'

    const raw    = await callAI(prompt)
    console.log('[PolicyBot] Raw response:', raw.slice(0, 200))
    const parsed = safeParseJSON(raw)

    if (parsed && parsed.answer) {
      return { answer: parsed.answer, source_section: parsed.source_section || null, confidence: parsed.confidence || 85, is_local: false }
    }
    if (raw && raw.trim().length > 10) {
      return { answer: raw.trim().slice(0, 600), source_section: 'Company Policy', confidence: 70, is_local: false }
    }
    throw new Error('Empty response')
  } catch (err) {
    console.error('[PolicyBot] Failed:', err.message, '- falling back to local search')
    return localPolicySearch(question, policyContext)
  }
}

// --- Local keyword fallback ---
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

  const match = SECTIONS.find(function(s) { return s.keys.some(function(k) { return q.includes(k) }) })
  if (!match) {
    return { answer: "I couldn't find that in the policy. Please contact HR at hr@company.com.", source_section: null, confidence: 40, is_local: true }
  }

  const lines   = policyContext.split('\n').map(function(l) { return l.trim() }).filter(Boolean)
  let capturing = false
  const bullets = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes(match.section)) { capturing = true; continue }
    if (capturing) {
      if (line.endsWith(':') && line === line.toUpperCase()) break
      if (line.startsWith('-')) bullets.push(line)
      if (bullets.length >= 4) break
    }
  }

  if (!bullets.length) {
    return { answer: 'Found the ' + match.section.toLowerCase() + ' section but could not extract details. Contact HR at hr@company.com.', source_section: match.section, confidence: 60, is_local: true }
  }
  return { answer: bullets.join('\n'), source_section: match.section, confidence: 80, is_local: true }
}

// Legacy aliases
export { callAI as callGemini, callAIVision as callGeminiVision }