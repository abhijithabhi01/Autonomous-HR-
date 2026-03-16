// src/lib/ai.js
// Gemini 2.5 Flash via Vertex AI (Supabase Edge Function proxy)
//
// SETUP:
//   1. supabase functions deploy gemini-proxy --no-verify-jwt
//   2. supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
//   3. supabase secrets set VERTEX_REGION=us-central1  (only if not us-central1)

import { supabase } from './supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Startup check
;(function checkConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[ai.js] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in .env')
  } else {
    console.log('[ai.js] Gemini proxy ready via', SUPABASE_URL + '/functions/v1/gemini-proxy')
  }
})()

// ---- Call the edge function ---------------------------------
// Uses raw fetch instead of supabase.functions.invoke so we can
// always attach the anon key regardless of auth state.
async function callProxy(type, prompt, base64, mimeType) {
  var body = { type: type, prompt: prompt }
  if (base64)   body.base64   = base64
  if (mimeType) body.mimeType = mimeType

  var url = SUPABASE_URL + '/functions/v1/gemini-proxy'

  // Get the current session token if logged in, fall back to anon key
  var session = supabase.auth.session ? supabase.auth.session() : null
  var token   = (session && session.access_token) ? session.access_token : SUPABASE_ANON_KEY

  var res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey':        SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    var errText = await res.text().catch(function() { return '' })
    console.error('[proxy] HTTP', res.status, errText.slice(0, 200))
    throw new Error('Edge function HTTP ' + res.status + ': ' + errText.slice(0, 100))
  }

  var data = await res.json()
  if (data && data.error) throw new Error(data.error)
  if (!data || !data.text) throw new Error('Edge function returned empty response')
  return data.text
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
export async function callAI(prompt) {
  return callProxy('text', prompt)
}

// ---- Public: vision ----------------------------------------
export async function callAIVision(base64Image, mimeType, prompt) {
  return callProxy('vision', prompt, base64Image, mimeType)
}

// ---- Document Verification ---------------------------------
export async function verifyDocument(base64, mimeType, documentType) {
  if (mimeType === 'application/pdf') {
    return {
      is_authentic: null,
      confidence:   0,
      flags:        ['PDF uploaded'],
      note:         'PDF saved. Upload a JPG or PNG screenshot to enable AI field extraction.',
    }
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
  var prompt =
    'You are an OCR system. Extract all visible text from this document image and return ONLY a JSON object ' +
    'matching this exact structure - no markdown, no explanation:\n' +
    template +
    '\nFill every field you can read. Use empty string "" for any field you cannot read clearly.'

  try {
    console.log('[OCR] Calling Vertex AI Gemini 2.5 Flash for', documentType)
    var raw    = await callProxy('vision', prompt, base64, mimeType)
    console.log('[OCR] Raw response:', raw.slice(0, 300))
    var parsed = safeParseJSON(raw)
    if (parsed) {
      var filled = Object.keys(parsed).filter(function(k) {
        var v = parsed[k]
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

// ---- Document Expiry Check ---------------------------------
export async function checkDocumentExpiry(expiryDateStr, documentType) {
  documentType = documentType || 'document'
  if (!expiryDateStr) return { status: 'unknown', days_remaining: null, message: 'No expiry date provided' }

  var expiry = new Date(expiryDateStr)
  var today  = new Date()
  var days   = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))

  var status =
    days < 0   ? 'expired'  :
    days < 30  ? 'critical' :
    days < 90  ? 'warning'  :
    days < 180 ? 'notice'   : 'ok'

  var msgs = {
    expired:  documentType + ' expired ' + Math.abs(days) + ' days ago. Immediate renewal required.',
    critical: documentType + ' expires in ' + days + ' days. Urgent renewal needed.',
    warning:  documentType + ' expires in ' + days + ' days. Renewal recommended soon.',
    notice:   documentType + ' expires in ' + days + ' days. Plan renewal within 3 months.',
    ok:       documentType + ' is valid for ' + days + ' more days.',
  }

  try {
    var prompt =
      'A ' + documentType + ' expires on ' + expiryDateStr +
      '. Today is ' + today.toISOString().slice(0, 10) +
      '. Days remaining: ' + days +
      '. Write a 1-sentence HR alert. Return ONLY raw JSON: ' +
      '{"status":"' + status + '","days_remaining":' + days +
      ',"message":"your message","action_required":' + (days < 90) + '}'
    var raw    = await callProxy('text', prompt)
    var parsed = safeParseJSON(raw)
    if (parsed && parsed.message) return parsed
    return { status: status, days_remaining: days, message: msgs[status] }
  } catch (_) {
    return { status: status, days_remaining: days, message: msgs[status] }
  }
}

// ---- Policy Q&A --------------------------------------------
export async function answerPolicyQuestion(question, policyContext) {
  console.log('[PolicyBot] Routing via Vertex AI edge function')
  try {
    var prompt =
      'You are a helpful HR Policy Assistant. Answer using ONLY the policy context below. ' +
      'Be concise (2-3 sentences max). If not covered, say so and suggest contacting HR at hr@company.com.\n\n' +
      'COMPANY POLICY:\n' + policyContext + '\n\n' +
      'EMPLOYEE QUESTION: ' + question + '\n\n' +
      'Return ONLY a raw JSON object - no markdown, no extra text:\n' +
      '{"answer":"your answer here","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}'

    var raw    = await callProxy('text', prompt)
    console.log('[PolicyBot] Raw response:', raw.slice(0, 200))
    var parsed = safeParseJSON(raw)

    if (parsed && parsed.answer) {
      return {
        answer:         parsed.answer,
        source_section: parsed.source_section || null,
        confidence:     parsed.confidence || 85,
        is_local:       false,
      }
    }
    if (raw && raw.trim().length > 10) {
      return { answer: raw.trim().slice(0, 600), source_section: 'Company Policy', confidence: 70, is_local: false }
    }
    throw new Error('Empty response from model')
  } catch (err) {
    console.error('[PolicyBot] Failed:', err.message, '- falling back to local search')
    return localPolicySearch(question, policyContext)
  }
}

// ---- Local keyword fallback --------------------------------
export function localPolicySearch(question, policyContext) {
  var q = question.toLowerCase()
  var SECTIONS = [
    { keys: ['annual leave', 'vacation', 'holiday', 'days off', 'pto', 'time off'], section: 'LEAVE POLICY' },
    { keys: ['sick', 'medical', 'ill', 'unwell'],                                   section: 'LEAVE POLICY' },
    { keys: ['maternity', 'paternity', 'parental', 'baby'],                         section: 'LEAVE POLICY' },
    { keys: ['remote', 'work from home', 'wfh', 'hybrid'],                         section: 'REMOTE WORK POLICY' },
    { keys: ['travel', 'expense', 'receipt', 'flight', 'reimburse'],               section: 'TRAVEL AND EXPENSES POLICY' },
    { keys: ['laptop', 'equipment', 'device', 'vpn', 'software'],                  section: 'IT AND EQUIPMENT POLICY' },
    { keys: ['probation', 'trial period', 'notice', 'resignation'],                section: 'PROBATION POLICY' },
    { keys: ['salary', 'pay', 'payroll', 'wage', 'bonus', 'increment'],            section: 'SALARY AND PAYROLL' },
  ]

  var match = SECTIONS.find(function(s) {
    return s.keys.some(function(k) { return q.includes(k) })
  })

  if (!match) {
    return {
      answer:         "I couldn't find that in the policy. Please contact HR at hr@company.com.",
      source_section: null,
      confidence:     40,
      is_local:       true,
    }
  }

  var lines     = policyContext.split('\n').map(function(l) { return l.trim() }).filter(Boolean)
  var capturing = false
  var bullets   = []
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line.includes(match.section)) { capturing = true; continue }
    if (capturing) {
      if (line.endsWith(':') && line === line.toUpperCase()) break
      if (line.startsWith('-')) bullets.push(line)
      if (bullets.length >= 4) break
    }
  }

  if (!bullets.length) {
    return {
      answer:         'Found the ' + match.section.toLowerCase() + ' section but could not extract details. Contact HR at hr@company.com.',
      source_section: match.section,
      confidence:     60,
      is_local:       true,
    }
  }
  return { answer: bullets.join('\n'), source_section: match.section, confidence: 80, is_local: true }
}

// Legacy aliases
export { callAI as callGemini, callAIVision as callGeminiVision }