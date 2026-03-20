// api/send-email.js  — place this file at your project ROOT (next to package.json)
// Vercel automatically exposes this as  /api/send-email
// RESEND_API_KEY is set in the Vercel dashboard (never in the frontend bundle)

export default async function handler(req, res) {
  // ── CORS — allow your frontend origin ────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM    = process.env.RESEND_FROM || 'HR Team <onboarding@resend.dev>'

  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'RESEND_API_KEY not configured in Vercel environment variables' })
    return
  }

  const { toEmail, toName, loginEmail, tempPassword, position, department, startDate, portalUrl } = req.body

  if (!toEmail || !toName || !loginEmail || !tempPassword) {
    res.status(400).json({ error: 'Missing required fields' }); return
  }

  const firstName      = toName.split(' ')[0]
  const formattedStart = startDate
    ? new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBD'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
          <div style="font-size:32px;margin-bottom:12px">🎉</div>
          <h1 style="margin:0;color:#2DD4BF;font-size:24px;font-weight:700">Welcome to D Company!</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">We're excited to have you on board</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
            You're joining as <strong>${position}</strong> in the <strong>${department}</strong> team,
            starting <strong>${formattedStart}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 16px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">
                Login Credentials
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
                <tr>
                  <td style="padding:6px 0;color:#64748b;width:100px">Portal</td>
                  <td><a href="${portalUrl || '#'}" style="color:#2DD4BF;text-decoration:none">${portalUrl || 'See HR for link'}</a></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b">Email</td>
                  <td style="font-weight:600;color:#0f172a">${loginEmail}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b">Password</td>
                  <td><code style="background:#e2e8f0;padding:3px 8px;border-radius:6px;font-weight:600;font-size:14px">${tempPassword}</code></td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:12px 24px;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8">⚠️ Please change your password after your first login.</p>
            </td></tr>
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
        subject: `Welcome to D Company, ${firstName}! 🎉 Your login details`,
        html,
      }),
    })

    const result = await resendRes.json()
    if (!resendRes.ok) {
      console.error('[send-email] Resend error:', result)
      return res.status(resendRes.status).json({ error: result.message || 'Resend API error' })
    }

    console.log('[send-email] Sent:', result.id, '→', toEmail)
    return res.status(200).json({ success: true, id: result.id })
  } catch (err) {
    console.error('[send-email] fetch error:', err)
    return res.status(500).json({ error: err.message })
  }
}