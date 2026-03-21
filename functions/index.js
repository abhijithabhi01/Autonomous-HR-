// functions/index.js
// Firebase Cloud Functions — Gemini proxy + Resend welcome email
//
// ── Setup ────────────────────────────────────────────────────
// 1. Add your keys to  functions/.env  (never committed to git):
//      GEMINI_API_KEY=AIza...
//      RESEND_API_KEY=re_...
//      RESEND_FROM=HR Team <hr@yourdomain.com>
//
//    For the "from" address you need either:
//      • A verified domain in Resend (resend.com/domains)
//      • Or use  onboarding@resend.dev  while testing (Resend's free sandbox)
//
// 2. Deploy:
//      cd functions && npm install
//      firebase deploy --only functions
// ─────────────────────────────────────────────────────────────

const { onRequest } = require('firebase-functions/v2/https')

// ── CORS helper ───────────────────────────────────────────────
function setCors(res) {
  res.set('Access-Control-Allow-Origin',  '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// ============================================================
// 1. GEMINI PROXY  (existing — unchanged)
// ============================================================
exports.geminiProxy = onRequest({ timeoutSeconds: 60 }, async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY not set in functions/.env' })
    return
  }

  const { type, prompt, base64, mimeType } = req.body
  if (!prompt) { res.status(400).json({ error: 'prompt is required' }); return }

  const MODEL   = 'gemini-2.5-flash'
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const parts = [{ text: prompt }]
  if (type === 'vision' && base64 && mimeType) {
    parts.push({ inline_data: { mime_type: mimeType, data: base64 } })
  }

  try {
    const geminiRes = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents:         [{ parts }],
        generationConfig: { temperature: type === 'vision' ? 0.1 : 0.3, maxOutputTokens: 2048 },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      res.status(geminiRes.status).json({ error: errText })
      return
    }

    const data = await geminiRes.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    res.json({ text })
  } catch (err) {
    console.error('[geminiProxy]', err)
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 2. SEND WELCOME EMAIL  (new — uses Resend)
// ============================================================
exports.sendWelcomeEmail = onRequest({ timeoutSeconds: 30 }, async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM    = process.env.RESEND_FROM || 'HR Team <onboarding@resend.dev>'

  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'RESEND_API_KEY not set in functions/.env' })
    return
  }

  const { toEmail, toName, loginEmail, tempPassword, position, department, startDate, portalUrl } = req.body

  if (!toEmail || !toName || !loginEmail || !tempPassword) {
    res.status(400).json({ error: 'Missing required fields: toEmail, toName, loginEmail, tempPassword' })
    return
  }

  const formattedStart = startDate
    ? new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBD'

  const firstName = toName.split(' ')[0]
  const portal    = portalUrl || 'your onboarding portal'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
          <div style="font-size:32px;margin-bottom:12px">🎉</div>
          <h1 style="margin:0;color:#2DD4BF;font-size:24px;font-weight:700">Welcome to D Company!</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">We're excited to have you on board</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
            You're joining as <strong style="color:#0f172a">${position}</strong> in the
            <strong style="color:#0f172a">${department}</strong> team, starting
            <strong style="color:#0f172a">${formattedStart}</strong>.
            Your onboarding portal will guide you through every step.
          </p>

          <!-- Credentials box -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
            <tr><td style="padding:20px 24px 12px">
              <p style="margin:0 0 16px;font-weight:700;color:#0f172a;font-size:14px;text-transform:uppercase;letter-spacing:0.05em">
                Your Login Credentials
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr>
                  <td style="padding:8px 0;color:#64748b;width:110px;vertical-align:top">Portal</td>
                  <td style="padding:8px 0">
                    <a href="${portal}" style="color:#2DD4BF;text-decoration:none;font-weight:500">${portal}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;vertical-align:top">Email</td>
                  <td style="padding:8px 0;font-weight:600;color:#0f172a">${loginEmail}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;vertical-align:top">Password</td>
                  <td style="padding:8px 0">
                    <code style="background:#e2e8f0;padding:3px 8px;border-radius:6px;font-size:14px;color:#0f172a;font-weight:600">${tempPassword}</code>
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:12px 24px 20px;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8">
                ⚠️ Please change your password immediately after your first login.
              </p>
            </td></tr>
          </table>

          <!-- Steps -->
          <p style="margin:0 0 12px;font-weight:700;color:#0f172a;font-size:14px">What to do next:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            ${[
              ['1', 'Log in to the portal using the credentials above'],
              ['2', 'Complete your profile (takes ~5 minutes)'],
              ['3', 'Upload your required documents'],
              ['4', 'Work through your onboarding checklist'],
            ].map(([n, text]) => `
            <tr>
              <td width="32" style="padding:6px 0;vertical-align:top">
                <div style="width:24px;height:24px;background:#dbeafe;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#2563eb">${n}</div>
              </td>
              <td style="padding:6px 0;font-size:14px;color:#475569">${text}</td>
            </tr>`).join('')}
          </table>

          <p style="margin:0 0 4px;font-size:14px;color:#475569">
            Looking forward to seeing you on <strong>${formattedStart}</strong>!
          </p>
          <p style="margin:24px 0 0;font-size:14px;color:#94a3b8">The HR Team · D Company</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [toEmail],
        subject: `Welcome to D Company, ${firstName}! 🎉 Your login details inside`,
        html,
      }),
    })

    const result = await resendRes.json()

    if (!resendRes.ok) {
      console.error('[sendWelcomeEmail] Resend error:', result)
      res.status(resendRes.status).json({ error: result.message || 'Resend API error' })
      return
    }

    console.log('[sendWelcomeEmail] Sent:', result.id, '→', toEmail)
    res.json({ success: true, id: result.id })
  } catch (err) {
    console.error('[sendWelcomeEmail]', err)
    res.status(500).json({ error: err.message })
  }
})
// ============================================================
// 3. DELETE ORPHANED AUTH ACCOUNT  (Admin SDK)
// ============================================================
// Called by the client when it detects email-already-in-use but
// no Firestore profile exists — i.e. an auth account was created
// in a previous failed attempt without a matching profile.
//
// The Admin SDK can delete any auth account by email, which the
// client SDK cannot.  After deletion, the client retries signUp.
// ─────────────────────────────────────────────────────────────
const admin = require('firebase-admin')

// Initialize admin only once (guard against multiple requires)
if (!admin.apps.length) {
  admin.initializeApp()
}

exports.deleteOrphanedAuth = onRequest({ timeoutSeconds: 15 }, async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const { email } = req.body
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email is required' })
    return
  }

  try {
    // Look up the auth account by email
    const userRecord = await admin.auth().getUserByEmail(email)

    // Safety check: only delete accounts that have NO Firestore profile
    // (i.e. genuinely orphaned). If a profile exists, refuse the delete
    // so we don't accidentally nuke a legitimate account.
    const profileSnap = await admin.firestore()
      .collection('profiles')
      .doc(userRecord.uid)
      .get()

    if (profileSnap.exists) {
      console.warn('[deleteOrphanedAuth] Profile exists for', email, '— refusing delete')
      res.status(409).json({
        error: 'Account has a profile and is not orphaned. Manual review required.',
        uid: userRecord.uid,
      })
      return
    }

    // Profile doesn't exist → safe to delete the orphaned auth account
    await admin.auth().deleteUser(userRecord.uid)
    console.log('[deleteOrphanedAuth] Deleted orphaned auth account for', email, 'uid:', userRecord.uid)
    res.json({ success: true, deleted: email })

  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Already deleted — that's fine, return success so client can retry signUp
      console.log('[deleteOrphanedAuth] Account not found (already deleted):', email)
      res.json({ success: true, deleted: email, note: 'account was already absent' })
    } else {
      console.error('[deleteOrphanedAuth] Error:', err)
      res.status(500).json({ error: err.message })
    }
  }
})