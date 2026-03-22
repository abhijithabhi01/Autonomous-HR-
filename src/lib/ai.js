// src/lib/ai.js
// Minimal AI helper — only the PolicyBot chatbot function.
// Document verification (verifyDocumentViaBackend) was removed here
// and moved to inline fetch calls in Documents.jsx and EmployeeDetail.jsx.
//
// PolicyBot calls Gemini directly from the browser (client-side).
// This is intentional — the chatbot is read-only, uses a restricted
// AI Studio key, and doesn't need server-side processing.

const GEMINI_KEY  = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL       = 'gemini-2.0-flash'

// ── Core text call ────────────────────────────────────────────
async function geminiText(prompt) {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY not set in .env')
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

function safeParseJSON(raw) {
  if (!raw) return null
  const s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(s) } catch (_) {}
  const m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (_) {} }
  return null
}

// ── Policy Q&A (used by PolicyBot) ───────────────────────────
export async function answerPolicyQuestion(question, policyContext) {
  if (!GEMINI_KEY) return localPolicySearch(question, policyContext)

  try {
    const prompt =
      'You are a helpful HR Policy Assistant. Answer using ONLY the policy context below. ' +
      'Be concise (2-3 sentences). If not covered, say so.\n\n' +
      'COMPANY POLICY:\n' + policyContext + '\n\n' +
      'EMPLOYEE QUESTION: ' + question + '\n\n' +
      'Return ONLY raw JSON - no markdown:\n' +
      '{"answer":"your answer","source_section":"e.g. Leave Policy","confidence":90,"found_in_policy":true}'

    const raw    = await geminiText(prompt)
    const parsed = safeParseJSON(raw)

    if (parsed?.answer) {
      return { answer: parsed.answer, source_section: parsed.source_section || null, confidence: parsed.confidence || 85, is_local: false }
    }
    if (raw?.trim().length > 10) {
      return { answer: raw.trim().slice(0, 600), source_section: 'Company Policy', confidence: 70, is_local: false }
    }
  } catch (err) {
    console.warn('[PolicyBot] Gemini failed:', err.message)
  }

  return localPolicySearch(question, policyContext)
}

function localPolicySearch(question, policyContext) {
  const q = question.toLowerCase()
  const SECTIONS = [
    { keys: ['annual leave', 'vacation', 'holiday', 'days off', 'time off'], section: 'LEAVE POLICY' },
    { keys: ['sick', 'medical', 'ill', 'unwell'], section: 'LEAVE POLICY' },
    { keys: ['maternity', 'paternity', 'parental', 'baby'],                 section: 'LEAVE POLICY' },
    { keys: ['remote', 'work from home', 'wfh', 'hybrid'],                  section: 'REMOTE WORK POLICY' },
    { keys: ['travel', 'expense', 'receipt', 'flight', 'reimburse'],        section: 'TRAVEL AND EXPENSES POLICY' },
    { keys: ['laptop', 'equipment', 'device', 'vpn', 'software'],           section: 'IT AND EQUIPMENT POLICY' },
    { keys: ['probation', 'trial period', 'notice', 'resignation'],         section: 'PROBATION POLICY' },
    { keys: ['salary', 'pay', 'payroll', 'wage', 'bonus', 'increment'],     section: 'SALARY AND PAYROLL' },
  ]
  const match = SECTIONS.find(s => s.keys.some(k => q.includes(k)))
  if (!match) return { answer: "I couldn't find that in the policy. Please contact HR at hr@company.com.", source_section: null, confidence: 40, is_local: true }

  const lines = policyContext.split('\n').map(l => l.trim()).filter(Boolean)
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
  if (!bullets.length) return { answer: `Found ${match.section.toLowerCase()} but couldn't extract details. Contact HR at hr@company.com.`, source_section: match.section, confidence: 60, is_local: true }
  return { answer: bullets.join('\n'), source_section: match.section, confidence: 80, is_local: true }
}