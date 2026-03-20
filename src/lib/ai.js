// src/lib/ai.js
// Gemini 2.5 Flash via Google AI Studio API key (direct, no backend needed)
// Add to .env: VITE_GEMINI_API_KEY=AIzaSy...
// Get free key: https://aistudio.google.com/apikey

var GEMINI_KEY  = import.meta.env.VITE_GEMINI_API_KEY
var GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
var MODEL       = 'gemini-2.5-flash'

;(function checkKey() {
  if (!GEMINI_KEY) {
    console.error('[ai.js] VITE_GEMINI_API_KEY not set. Get a free key at aistudio.google.com/apikey and add to .env')
  } else {
    console.log('[ai.js] Gemini key loaded:', GEMINI_KEY.slice(0, 12) + '...')
  }
})()

// ---- Core text call ----------------------------------------
async function geminiText(prompt) {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY not set in .env')
  var res = await fetch(GEMINI_BASE + '/' + MODEL + ':generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) {
    var err = await res.json().catch(function() { return {} })
    throw new Error((err.error && err.error.message) || ('HTTP ' + res.status))
  }
  var data = await res.json()
  var text = data.candidates && data.candidates[0] && data.candidates[0].content &&
             data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
             data.candidates[0].content.parts[0].text
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

// ---- Core vision call --------------------------------------
async function geminiVision(base64, mimeType, prompt) {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY not set in .env')
  var res = await fetch(GEMINI_BASE + '/' + MODEL + ':generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
    }),
  })
  if (!res.ok) {
    var err = await res.json().catch(function() { return {} })
    throw new Error((err.error && err.error.message) || ('HTTP ' + res.status))
  }
  var data = await res.json()
  var text = data.candidates && data.candidates[0] && data.candidates[0].content &&
             data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
             data.candidates[0].content.parts[0].text
  if (!text) throw new Error('Gemini vision returned empty response')
  return text
}

// ---- JSON extractor ----------------------------------------
function safeParseJSON(raw) {
  if (!raw) return null
  var s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(s) } catch (_) {}
  var m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (_) {} }
  return null
}

// ---- Public: text ------------------------------------------
export async function callAI(prompt) { return geminiText(prompt) }
export async function callAIVision(base64Image, mimeType, prompt) {
  return geminiVision(base64Image, mimeType, prompt)
}

// ---- Document Verification (OCR) ---------------------------
export async function verifyDocument(base64, mimeType, documentType) {
  if (mimeType === 'application/pdf') {
    return { is_authentic: null, confidence: 0, flags: ['PDF uploaded'],
      note: 'PDF saved. Upload a JPG or PNG screenshot to enable AI field extraction.' }
  }
  if (!GEMINI_KEY) {
    return { is_authentic: null, confidence: 0, flags: [],
      note: 'VITE_GEMINI_API_KEY not set. Get a free key at aistudio.google.com/apikey' }
  }
  var TEMPLATES = {
    passport:          '{"name":"","passport_number":"","date_of_birth":"","nationality":"","expiry_date":"","is_authentic":true,"confidence":90,"flags":[]}',
    visa:              '{"visa_type":"","holder_name":"","country":"","expiry_date":"","permitted_activities":"","is_authentic":true,"confidence":90,"flags":[]}',
    degree:            '{"student_name":"","institution":"","degree":"","field_of_study":"","graduation_year":"","is_authentic":true,"confidence":88,"flags":[]}',
    employment_letter: '{"employee_name":"","company":"","position":"","start_date":"","end_date":"","is_authentic":true,"confidence":85,"flags":[]}',
    bank_details:      '{"account_holder":"","bank_name":"","account_type":"","account_number":"","ifsc_code":"","is_authentic":true,"confidence":90,"flags":[]}',
    aadhaar:           '{"name":"","aadhaar_number":"","date_of_birth":"","gender":"","address":"","is_authentic":true,"confidence":90,"flags":[]}',
    pan_card:          '{"name":"","pan_number":"","father_name":"","date_of_birth":"","is_authentic":true,"confidence":90,"flags":[]}',
  }
  var template = TEMPLATES[documentType] || TEMPLATES.passport
  var prompt = 'You are an OCR system. Extract all visible text from this document image and return ONLY a JSON object matching this exact structure - no markdown, no explanation:\n' +
    template + '\nFill every field you can read. Use empty string "" for any field you cannot read clearly.'
  try {
    console.log('[OCR] Calling Gemini', MODEL, 'for', documentType)
    var raw = await geminiVision(base64, mimeType, prompt)
    console.log('[OCR] Raw:', raw.slice(0, 200))
    var parsed = safeParseJSON(raw)
    if (parsed) {
      console.log('[OCR] Fields:', Object.keys(parsed).filter(function(k) { var v = parsed[k]; return v && v !== true && !Array.isArray(v) }))
      return parsed
    }
    throw new Error('Not valid JSON: ' + raw.slice(0, 100))
  } catch (err) {
    console.error('[OCR] Failed:', err.message)
    return { is_authentic: null, confidence: 0, flags: ['OCR failed'],
      note: 'AI extraction failed: ' + err.message + '. Fill in the fields manually.' }
  }
}

// ---- Document Expiry Check ---------------------------------
export async function checkDocumentExpiry(expiryDateStr, documentType) {
  documentType = documentType || 'document'
  if (!expiryDateStr) return { status: 'unknown', days_remaining: null, message: 'No expiry date provided' }
  var expiry = new Date(expiryDateStr), today = new Date()
  var days = Math.ceil((expiry - today) / 86400000)
  var status = days < 0 ? 'expired' : days < 30 ? 'critical' : days < 90 ? 'warning' : days < 180 ? 'notice' : 'ok'
  var msgs = {
    expired: documentType + ' expired ' + Math.abs(days) + ' days ago.',
    critical: documentType + ' expires in ' + days + ' days. Urgent renewal needed.',
    warning: documentType + ' expires in ' + days + ' days. Renewal recommended.',
    notice: documentType + ' expires in ' + days + ' days. Plan renewal soon.',
    ok: documentType + ' is valid for ' + days + ' more days.',
  }
  if (!GEMINI_KEY) return { status: status, days_remaining: days, message: msgs[status] }
  try {
    var raw = await geminiText('A ' + documentType + ' expires on ' + expiryDateStr + '. Today is ' + today.toISOString().slice(0,10) + '. Days: ' + days + '. Return ONLY JSON: {"status":"' + status + '","days_remaining":' + days + ',"message":"1-sentence HR alert","action_required":' + (days < 90) + '}')
    var parsed = safeParseJSON(raw)
    if (parsed && parsed.message) return parsed
  } catch (_) {}
  return { status: status, days_remaining: days, message: msgs[status] }
}

// ---- Policy Q&A --------------------------------------------
export async function answerPolicyQuestion(question, policyContext) {
  console.log('[PolicyBot] Calling Gemini', MODEL)
  if (!GEMINI_KEY) { return localPolicySearch(question, policyContext) }
  try {
    var prompt = 'You are a helpful HR Policy Assistant. Answer using ONLY the policy context below. Be concise (2-3 sentences). If not covered, say so.\n\nCOMPANY POLICY:\n' + policyContext + '\n\nEMPLOYEE QUESTION: ' + question + '\n\nReturn ONLY raw JSON - no markdown:\n{"answer":"your answer","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}'
    var raw = await geminiText(prompt)
    var parsed = safeParseJSON(raw)
    if (parsed && parsed.answer) return { answer: parsed.answer, source_section: parsed.source_section || null, confidence: parsed.confidence || 85, is_local: false }
    if (raw && raw.trim().length > 10) return { answer: raw.trim().slice(0, 600), source_section: 'Company Policy', confidence: 70, is_local: false }
  } catch (err) { console.warn('[PolicyBot] Gemini failed:', err.message) }
  return localPolicySearch(question, policyContext)
}

export function localPolicySearch(question, policyContext) {
  var q = question.toLowerCase()
  var SECTIONS = [
    { keys: ['annual leave', 'vacation', 'holiday', 'days off', 'pto', 'time off'], section: 'LEAVE POLICY' },
    { keys: ['sick', 'medical', 'ill', 'unwell'], section: 'LEAVE POLICY' },
    { keys: ['maternity', 'paternity', 'parental', 'baby'], section: 'LEAVE POLICY' },
    { keys: ['remote', 'work from home', 'wfh', 'hybrid'], section: 'REMOTE WORK POLICY' },
    { keys: ['travel', 'expense', 'receipt', 'flight', 'reimburse'], section: 'TRAVEL AND EXPENSES POLICY' },
    { keys: ['laptop', 'equipment', 'device', 'vpn', 'software'], section: 'IT AND EQUIPMENT POLICY' },
    { keys: ['probation', 'trial period', 'notice', 'resignation'], section: 'PROBATION POLICY' },
    { keys: ['salary', 'pay', 'payroll', 'wage', 'bonus', 'increment'], section: 'SALARY AND PAYROLL' },
  ]
  var match = SECTIONS.find(function(s) { return s.keys.some(function(k) { return q.includes(k) }) })
  if (!match) return { answer: "I couldn't find that in the policy. Please contact HR at hr@company.com.", source_section: null, confidence: 40, is_local: true }
  var lines = policyContext.split('\n').map(function(l) { return l.trim() }).filter(Boolean)
  var capturing = false, bullets = []
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line.includes(match.section)) { capturing = true; continue }
    if (capturing) {
      if (line.endsWith(':') && line === line.toUpperCase()) break
      if (line.startsWith('-')) bullets.push(line)
      if (bullets.length >= 4) break
    }
  }
  if (!bullets.length) return { answer: 'Found ' + match.section.toLowerCase() + ' section but could not extract details. Contact HR at hr@company.com.', source_section: match.section, confidence: 60, is_local: true }
  return { answer: bullets.join('\n'), source_section: match.section, confidence: 80, is_local: true }
}

export { callAI as callGemini, callAIVision as callGeminiVision }