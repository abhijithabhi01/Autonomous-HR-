// functions/index.js
// Firebase Cloud Functions — Gemini proxy + Gmail welcome email + orphaned auth cleanup
//
// ── Setup ────────────────────────────────────────────────────
// 1. Add your keys to  functions/.env  (never committed to git):
//      GEMINI_API_KEY=AIza...
//      GMAIL_USER=your@gmail.com
//      GMAIL_APP_PASSWORD=xxxxxxxxxxxx   (16-char App Password, no spaces)
//
// 2. Install nodemailer in functions folder:
//      cd functions && npm install nodemailer
//
// 3. Deploy:
//      firebase deploy --only functions
// ─────────────────────────────────────────────────────────────

const { onRequest } = require('firebase-functions/v2/https')
const admin         = require('firebase-admin')
const nodemailer    = require('nodemailer')

// ── Firebase Admin (auto-authenticated in Cloud Functions) ────
if (!admin.apps.length) {
  admin.initializeApp()   // no key needed — Cloud Functions auto-auth
}

// ── CORS helper ───────────────────────────────────────────────
function setCors(res) {
  res.set('Access-Control-Allow-Origin',  '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// ── Gmail transporter ─────────────────────────────────────────
// Built once, reused across warm instances.
// GMAIL_USER and GMAIL_APP_PASSWORD are set in functions/.env
function makeTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}
const transporter = makeTransporter()

// ============================================================
// 1. GEMINI PROXY
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
// 2. SEND WELCOME EMAIL — Gmail via Nodemailer
// ============================================================
exports.sendWelcomeEmail = onRequest({ timeoutSeconds: 30 }, async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  if (!transporter) {
    res.status(500).json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not set in functions/.env' })
    return
  }

  const { toEmail, toName, loginEmail, tempPassword, workEmail, position, department, startDate, portalUrl } = req.body
  if (!toEmail || !toName || !loginEmail || !tempPassword) {
    res.status(400).json({ error: 'Missing: toEmail, toName, loginEmail, tempPassword' })
    return
  }

  const firstName      = toName.split(' ')[0]
  const portalLink     = portalUrl || 'https://your-app.vercel.app/login'
  const formattedStart = startDate
    ? new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBD'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
          <div style="font-size:36px;margin-bottom:12px">🎉</div>
          <h1 style="margin:0;color:#2DD4BF;font-size:26px;font-weight:700">Welcome to D Company!</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">We're thrilled to have you on board</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>
          <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">
            You're joining as <strong style="color:#0f172a">${position}</strong> in the
            <strong style="color:#0f172a">${department}</strong> team,
            starting <strong style="color:#0f172a">${formattedStart}</strong>.
            Use the button below to access your onboarding portal.
          </p>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
            <tr><td align="center">
              <a href="${portalLink}"
                style="display:inline-block;background:#2DD4BF;color:#0C1A1D;font-weight:700;font-size:15px;
                       text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px">
                Click Here to Access Your Portal →
              </a>
            </td></tr>
            <tr><td align="center" style="padding-top:10px">
              <p style="margin:0;font-size:11px;color:#94a3b8">
                Or copy: <a href="${portalLink}" style="color:#2DD4BF;text-decoration:none">${portalLink}</a>
              </p>
            </td></tr>
          </table>

          <!-- Credentials -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
            <tr><td style="padding:20px 24px 12px">
              <p style="margin:0 0 16px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">
                Your Login Credentials
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr>
                  <td style="padding:8px 0;color:#64748b;width:130px;vertical-align:top">Login Email</td>
                  <td style="padding:8px 0;font-weight:600;color:#0f172a">${loginEmail}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;vertical-align:top">Password</td>
                  <td style="padding:8px 0">
                    <code style="background:#e2e8f0;padding:4px 10px;border-radius:6px;font-weight:700;font-size:14px;color:#0f172a">${tempPassword}</code>
                  </td>
                </tr>
                ${workEmail ? `<tr>
                  <td style="padding:8px 0;color:#64748b;vertical-align:top">Company Email</td>
                  <td style="padding:8px 0;font-weight:600;color:#2DD4BF">${workEmail}</td>
                </tr>` : ''}
              </table>
            </td></tr>
            <tr><td style="padding:12px 24px 16px;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8">⚠️ Change your password after first login.</p>
            </td></tr>
          </table>

          <!-- Steps -->
          <p style="margin:0 0 12px;font-weight:700;color:#0f172a;font-size:14px">What to do next:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            ${[
              ['1', 'Click the button above and log in'],
              ['2', 'Complete your personal profile (~5 minutes)'],
              ['3', 'Upload your required documents'],
              ['4', 'Work through your onboarding checklist'],
            ].map(([n, text]) => `
            <tr>
              <td width="32" style="padding:5px 0;vertical-align:top">
                <div style="width:22px;height:22px;background:#dbeafe;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;color:#2563eb">${n}</div>
              </td>
              <td style="padding:5px 0;font-size:14px;color:#475569">${text}</td>
            </tr>`).join('')}
          </table>

          <p style="margin:0;font-size:14px;color:#475569">See you on <strong>${formattedStart}</strong>! 🚀</p>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
            The HR Team · D Company
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const info = await transporter.sendMail({
      from:    `"D Company HR" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: `Welcome to D Company, ${firstName}! 🎉 Your login details`,
      html,
    })
    console.log(`[sendWelcomeEmail] ✅ Sent to ${toEmail} (${info.messageId})`)
    res.json({ success: true, messageId: info.messageId })
  } catch (err) {
    console.error('[sendWelcomeEmail] ❌', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 3. DELETE ORPHANED AUTH — Admin SDK (auto-auth in Cloud Functions)
// ============================================================
exports.deleteOrphanedAuth = onRequest({ timeoutSeconds: 15 }, async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const { email } = req.body
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email required' })
    return
  }

  try {
    let userRecord
    try {
      userRecord = await admin.auth().getUserByEmail(email)
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`[deleteOrphanedAuth] Already absent: ${email}`)
        res.json({ success: true, note: 'account was already absent' })
        return
      }
      throw err
    }

    const profileSnap = await admin.firestore().collection('profiles').doc(userRecord.uid).get()
    if (profileSnap.exists) {
      res.status(409).json({ error: 'Account has an active profile — not orphaned', uid: userRecord.uid })
      return
    }

    await admin.auth().deleteUser(userRecord.uid)
    console.log(`[deleteOrphanedAuth] ✅ Deleted: ${email}`)
    res.json({ success: true, deleted: email })
  } catch (err) {
    console.error('[deleteOrphanedAuth]', err.message)
    res.status(500).json({ error: err.message })
  }
})