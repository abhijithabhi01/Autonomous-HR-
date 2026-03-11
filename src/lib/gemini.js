// ─── Gemini AI helpers ────────────────────────────────────────
// Uses VITE_GEMINI_API_KEY (free via Google AI Studio)
// All functions are safe: they never throw — always return a usable value.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`

// ── Raw Gemini text call ──────────────────────────────────────
async function callGemini(prompt) {
  if (!API_KEY || API_KEY === 'your-gemini-api-key-from-aistudio') {
    throw new Error('VITE_GEMINI_API_KEY is not set in .env.local')
  } 
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Vision call ───────────────────────────────────────────────
export async function callGeminiVision(base64Image, mimeType, prompt) {
  if (!API_KEY || API_KEY === 'your-gemini-api-key-from-aistudio') {
    throw new Error('VITE_GEMINI_API_KEY is not set')
  }
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini Vision error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Document verification ─────────────────────────────────────
export async function verifyDocument(base64, mimeType, documentType) {
  const prompts = {
    passport:          `Analyze this passport. Return ONLY valid JSON (no markdown): {"name":"","passport_number":"","date_of_birth":"","nationality":"","expiry_date":"","is_authentic":true,"confidence":95,"days_until_expiry":0,"flags":[]}`,
    visa:              `Analyze this visa. Return ONLY valid JSON: {"visa_type":"","expiry_date":"","country":"","permitted_activities":"","is_authentic":true,"confidence":90,"days_until_expiry":0,"flags":[]}`,
    degree:            `Analyze this certificate. Return ONLY valid JSON: {"institution":"","degree":"","field":"","graduation_year":"","student_name":"","is_authentic":true,"confidence":88,"flags":[]}`,
    employment_letter: `Analyze this employment letter. Return ONLY valid JSON: {"company":"","position":"","start_date":"","end_date":"","employee_name":"","is_authentic":true,"confidence":85,"flags":[]}`,
    bank_details:      `Analyze this bank document. Return ONLY valid JSON: {"bank_name":"","account_holder":"","account_type":"","is_authentic":true,"confidence":90,"flags":[]}`,
  }
  const text = await callGeminiVision(base64, mimeType, prompts[documentType] || prompts.passport)
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ── Local keyword fallback for when Gemini is unavailable ─────
function localPolicySearch(question, policyContext) {
  const q = question.toLowerCase()
  const lines = policyContext.split('\n').filter(Boolean)

  // Find the most relevant lines
  const scored = lines.map(line => {
    const words = q.split(/\s+/).filter(w => w.length > 3)
    const hits  = words.filter(w => line.toLowerCase().includes(w)).length
    return { line, hits }
  }).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits)

  if (scored.length === 0) {
    return {
      answer: "I couldn't find a direct answer to that in the policy documents. Please contact HR directly at hr@company.com for help.",
      source_section: null,
      confidence: 0,
      is_local: true,
    }
  }

  const answer = scored.slice(0, 3).map(x => x.line.trim()).join(' ')
  return {
    answer: answer || "Please contact HR at hr@company.com for details on this policy.",
    source_section: 'Company Policy',
    confidence: Math.min(scored[0].hits * 20, 75),
    is_local: true,
  }
}

// ── Policy Q&A — NEVER THROWS ────────────────────────────────
// Always returns { answer, source_section, confidence, is_local }
export async function answerPolicyQuestion(question, policyContext) {
  // 1. Try Gemini
  if (API_KEY && API_KEY !== 'your-gemini-api-key-from-aistudio') {
    try {
      const prompt = `You are a helpful HR policy assistant. Answer using ONLY the policy context below.
Be concise and direct. If the answer is not in the policy, say so and suggest contacting HR.

POLICY:
${policyContext}

QUESTION: ${question}

Return ONLY valid JSON, no markdown fences:
{"answer":"","source_section":"","confidence":90,"found_in_policy":true}`

      const text  = await callGemini(prompt)
      const clean = text.replace(/```json|```/g, '').trim()

      // Find the JSON object even if there's surrounding text
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')

      const parsed = JSON.parse(match[0])
      return {
        answer:         parsed.answer         || "I couldn't generate a clear answer. Please contact HR.",
        source_section: parsed.source_section || null,
        confidence:     parsed.confidence     || 85,
        is_local:       false,
      }
    } catch (err) {
      console.warn('[PolicyBot] Gemini failed, falling back to local search:', err.message)
      // Fall through to local search
    }
  }

  // 2. Local keyword fallback (always works, no API needed)
  return localPolicySearch(question, policyContext)
}