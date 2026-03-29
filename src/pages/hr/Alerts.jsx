import { useState } from 'react'
import StatusBadge from '../../components/shared/StatusBadge'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useAlerts, useResolveAlert, useCandidates, useDocuments, useDeadlineAlerts } from '../../hooks/useData'
import toast from 'react-hot-toast'

const TYPE_ICON  = { expiry: '📅', stalled: '🐌', verification_failed: '❌', missing: '📭', document_mismatch: '⚠️', deadline: '⏰' }
const TYPE_LABEL = { expiry: 'Document Expiry', stalled: 'Onboarding Stalled', verification_failed: 'Verification Failed', missing: 'Missing Document', document_mismatch: 'Document Mismatch', deadline: 'Deadline Approaching' }

// ── doc_type key → human label ────────────────────────────────
const DOC_LABEL_MAP = {
  passport:          'Passport',
  visa:              'Visa / Work Permit',
  degree:            'Degree Certificate',
  employment_letter: 'Employment Letter',
  bank_details:      'Bank Details',
  profile_photo:     'Profile Photo',
  pan_card:          'PAN Card',
  national_id:       'National ID',
  driving_licence:   'Driving Licence',
}

export function resolveDocLabel(doc) {
  if (doc.label && doc.label !== doc.doc_type) return doc.label
  if (doc.doc_type && DOC_LABEL_MAP[doc.doc_type]) return DOC_LABEL_MAP[doc.doc_type]
  if (doc.doc_type) return doc.doc_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return 'Document'
}

const BASE   = (import.meta?.env?.VITE_BACKEND_URL || '').replace(/\/$/, '')
const apiUrl = (path) => BASE ? `${BASE}${path}` : path

// ── Expiry notification email (also exported for EmployeeDetail) ──
export async function sendExpiryNotificationEmail({ candidate, doc, daysUntilExpiry }) {
  const toEmail = candidate.personal_email || candidate.login_email
  if (!toEmail) throw new Error('No email address found for this candidate')

  const firstName     = candidate.full_name?.split(' ')[0] || candidate.full_name
  const isExpired     = daysUntilExpiry < 0
  const docLabel      = resolveDocLabel(doc)
  const expiryDate    = doc.expiry_date
  const formattedDate = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown'

  const subject = isExpired
    ? `⚠️ Action Required: Your ${docLabel} has expired`
    : `📅 Reminder: Your ${docLabel} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`

  const urgencyColor  = isExpired ? '#ef4444' : daysUntilExpiry < 30 ? '#f59e0b' : '#14b8a6'
  const urgencyBg     = isExpired ? '#fff1f2' : daysUntilExpiry < 30 ? '#fffbeb' : '#f0fdfa'
  const urgencyBorder = isExpired ? '#fecaca' : daysUntilExpiry < 30 ? '#fde68a' : '#99f6e4'

  const statusText = isExpired
    ? `Your <strong>${docLabel}</strong> <span style="color:#ef4444">expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? '' : 's'} ago</span> on ${formattedDate}.`
    : `Your <strong>${docLabel}</strong> will expire on <strong style="color:${urgencyColor}">${formattedDate}</strong> — that's <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}</strong> from today.`

  const actionText = isExpired
    ? 'Please renew your document immediately and upload the renewed copy to the HR portal to avoid any disruption to your employment.'
    : daysUntilExpiry < 30
      ? 'Please begin the renewal process as soon as possible and upload the renewed document to the HR portal.'
      : 'Please start the renewal process well in advance and upload the updated document when ready.'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
      <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">${isExpired ? '🚨' : '📅'}</div>
        <h1 style="margin:0;color:${urgencyColor};font-size:24px;font-weight:700">
          ${isExpired ? 'Document Expired' : 'Document Expiry Reminder'}
        </h1>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">D Company HR — Action Required</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
        <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>

        <div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7">${statusText}</p>
        </div>

        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7">${actionText}</p>

        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 12px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Document Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
              <tr>
                <td style="padding:6px 0;color:#64748b;width:140px">Document Type</td>
                <td style="font-weight:600;color:#0f172a">${docLabel}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b">Expiry Date</td>
                <td style="font-weight:600;color:${urgencyColor}">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b">Status</td>
                <td style="font-weight:700;color:${urgencyColor}">${isExpired ? '⛔ Expired' : daysUntilExpiry < 30 ? '⚠️ Expiring Soon' : '📅 Upcoming'}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td align="center">
            <a href="https://autonomous-hr.vercel.app"
              style="display:inline-block;background:#2DD4BF;color:#0C1A1D;font-weight:700;font-size:15px;
                     text-decoration:none;padding:14px 36px;border-radius:12px">
              Upload Renewed Document →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:#475569">If you need help, please contact the HR team directly.</p>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
          The HR Team · D Company
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const res = await fetch(apiUrl('/api/sendmail/notify'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ toEmail, toName: candidate.full_name, subject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Email send failed')
  }
  return { success: true }
}

// ── Document mismatch / verification-failed notification email ──
export async function sendMismatchNotificationEmail({ candidate, alertMessage }) {
  const toEmail = candidate.personal_email || candidate.login_email
  if (!toEmail) throw new Error('No email address found for this candidate')

  const firstName = candidate.full_name?.split(' ')[0] || candidate.full_name
  const subject   = `❌ Action Required: Document Verification Failed`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">❌</div>
        <h1 style="margin:0;color:#ef4444;font-size:24px;font-weight:700">Document Verification Failed</h1>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">D Company HR — Action Required</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
        <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>

        <div style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7">
            Our HR team was unable to verify one of your submitted documents.
            ${alertMessage ? `<br><br><strong>Details:</strong> ${alertMessage}` : ''}
          </p>
        </div>

        <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7">
          Please log in to the HR portal, review the flagged document, and re-upload a clear, valid copy.
          Make sure the document is not expired, clearly legible, and matches your profile information exactly.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 12px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Common Reasons for Failure</p>
            <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#475569">
              ${[
                ['🔍', 'Document image is blurry or partially obscured'],
                ['📋', 'Details on the document do not match your profile'],
                ['📅', 'Document is expired or outside the validity window'],
                ['🗂️', 'Wrong document type uploaded for this field'],
              ].map(([icon, text]) => `
              <tr>
                <td style="padding:5px 12px 5px 0;vertical-align:top;font-size:16px;width:28px">${icon}</td>
                <td style="padding:5px 0">${text}</td>
              </tr>`).join('')}
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td align="center">
            <a href="https://autonomous-hr.vercel.app"
              style="display:inline-block;background:#ef4444;color:#ffffff;font-weight:700;font-size:15px;
                     text-decoration:none;padding:14px 36px;border-radius:12px">
              Re-upload Document →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:#475569">
          If you believe this is an error or need assistance, please contact the HR team directly.
        </p>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
          The HR Team · D Company
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const res = await fetch(apiUrl('/api/sendmail/notify'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ toEmail, toName: candidate.full_name, subject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Email send failed')
  }
  return { success: true }
}

// ── Onboarding deadline urgency email ─────────────────────────
export async function sendDeadlineNotificationEmail({ candidate, daysLeft }) {
  const toEmail = candidate.personal_email || candidate.login_email
  if (!toEmail) throw new Error('No email address found for this candidate')

  const firstName   = candidate.full_name?.split(' ')[0] || candidate.full_name
  const progress    = candidate.onboarding_progress ?? 0
  const isOverdue   = daysLeft < 0
  const isToday     = daysLeft === 0
  const deadline    = candidate.start_date
    ? new Date(candidate.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'your deadline'

  const subject = isOverdue
    ? `🚨 Overdue: Your onboarding deadline has passed — action required`
    : isToday
      ? `🚨 Final Reminder: Your onboarding deadline is TODAY`
      : `⏰ Urgent: Your onboarding deadline is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`

  const headerColor = '#ef4444'
  const statusText  = isOverdue
    ? `Your onboarding deadline was <strong style="color:#ef4444">${deadline}</strong> — it has now passed and your process is only <strong>${progress}% complete</strong>.`
    : isToday
      ? `Your onboarding deadline is <strong style="color:#ef4444">today (${deadline})</strong> and your process is only <strong>${progress}% complete</strong>.`
      : `Your onboarding deadline is <strong style="color:#f59e0b">${deadline}</strong> — only <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'} left</strong> and you are ${progress}% complete.`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <tr><td style="background:#0C1A1D;padding:36px 40px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">${isOverdue ? '🚨' : '⏰'}</div>
        <h1 style="margin:0;color:${headerColor};font-size:24px;font-weight:700">
          ${isOverdue ? 'Onboarding Overdue' : isToday ? 'Deadline Is Today' : 'Deadline Approaching'}
        </h1>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">D Company HR — Immediate Action Required</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px">
        <p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hi <strong>${firstName}</strong>,</p>

        <div style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7">${statusText}</p>
        </div>

        <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7">
          Please log in to the HR portal immediately and complete any outstanding steps before your deadline.
          Incomplete onboarding may delay your joining process.
        </p>

        <!-- Progress bar -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 10px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Your Progress</p>
            <div style="background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden;margin-bottom:6px">
              <div style="background:${progress < 50 ? '#ef4444' : progress < 80 ? '#f59e0b' : '#22c55e'};height:10px;width:${progress}%;border-radius:99px;"></div>
            </div>
            <p style="margin:0;font-size:13px;color:#64748b;text-align:right;font-weight:600">${progress}% complete</p>

            <p style="margin:14px 0 8px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">What's still needed</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
              ${[
                ['📋', 'Complete your personal profile'],
                ['📄', 'Upload all required documents'],
                ['✅', 'Finish your onboarding checklist'],
              ].map(([icon, text]) => `
              <tr>
                <td style="padding:4px 0;width:28px;vertical-align:top;font-size:16px">${icon}</td>
                <td style="padding:4px 0;color:#475569">${text}</td>
              </tr>`).join('')}
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr><td align="center">
            <a href="https://autonomous-hr.vercel.app"
              style="display:inline-block;background:#ef4444;color:#ffffff;font-weight:700;font-size:15px;
                     text-decoration:none;padding:14px 36px;border-radius:12px">
              Complete Onboarding Now →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:#475569">If you need help, please contact the HR team immediately.</p>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
          The HR Team · D Company
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const res = await fetch(apiUrl('/api/sendmail/notify'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ toEmail, toName: candidate.full_name, subject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Email send failed')
  }
  return { success: true }
}

// ── Per-candidate doc expiry rows ─────────────────────────────
function CandidateDocAlerts({ candidate, onNotify, notifyingId, resolveMutation, setHasExpiry }) {
  const { data: docs = [] } = useDocuments(candidate.id)

  const expiryDocs = docs.filter(d => {
    if (!d.expiry_date) return false
    const days = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000)
    return days <= 90
  })

  if (expiryDocs.length > 0 && setHasExpiry) setHasExpiry(true)
  if (expiryDocs.length === 0) return null

  return expiryDocs.map(doc => {
    const days     = Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000)
    const severity = days < 0 ? 'high' : days < 30 ? 'high' : 'medium'
    const alertId  = `doc_${candidate.id}_${doc.id}`
    const docLabel = resolveDocLabel(doc)
    const toEmail  = candidate.personal_email || candidate.login_email

    const message = days < 0
      ? `${docLabel} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago (${new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`
      : `${docLabel} expires in ${days} day${days === 1 ? '' : 's'} on ${new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

    return (
      <AlertCard
        key={alertId}
        alert={{ id: alertId, type: 'expiry', severity, person_name: candidate.full_name, message }}
        delay={0}
        resolvable={false}
        resolveMutation={resolveMutation}
        extra={
          toEmail ? (
            <button
              onClick={() => onNotify({ candidate, doc, daysUntilExpiry: days, alertId })}
              disabled={notifyingId === alertId}
              className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-500/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {notifyingId === alertId
                ? <><span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin inline-block" />Sending…</>
                : '✉️ Notify Candidate'}
            </button>
          ) : (
            <span className="text-xs text-slate-600 italic">No email on file</span>
          )
        }
      />
    )
  })
}

// ── Alert card ────────────────────────────────────────────────
function AlertCard({ alert, delay = 0, extra, resolveMutation, resolvable = true, resolvedName }) {
  // Use resolvedName (looked-up from candidates list) with fallback to alert.person_name
  const displayName = resolvedName || alert.person_name

  return (
    <div className="rounded-2xl border p-4 sm:p-5 animate-slide-up opacity-0"
      style={{
        animationDelay: `${delay}ms`, animationFillMode: 'forwards',
        borderColor:     alert.severity === 'high'   ? 'rgba(239,68,68,0.15)' : alert.severity === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(20,184,166,0.15)',
        backgroundColor: alert.severity === 'high'   ? 'rgba(239,68,68,0.03)' : alert.severity === 'medium' ? 'rgba(245,158,11,0.02)' : 'rgba(20,184,166,0.02)',
      }}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg flex-shrink-0
            ${alert.severity === 'high'   ? 'bg-red-500/10 border border-red-500/20'
            : alert.severity === 'medium' ? 'bg-amber-500/10 border border-amber-500/20'
            :                               'bg-teal-500/10 border border-teal-500/20'}`}>
            {TYPE_ICON[alert.type] || '⚠️'}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {TYPE_LABEL[alert.type] || alert.type?.replace(/_/g, ' ')}
            </p>
            {/* ── Name — highlighted prominently, severity-tinted ── */}
            {displayName && (
              <p className={`font-bold text-sm mt-0.5 truncate
                ${alert.severity === 'high'   ? 'text-red-300'
                : alert.severity === 'medium' ? 'text-amber-300'
                :                               'text-teal-300'}`}>
                {displayName}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={alert.severity} />
      </div>

      <p className="text-sm text-slate-400 mb-4 pl-12 sm:pl-[52px]">{alert.message}</p>

      <div className="flex flex-wrap gap-2 pl-12 sm:pl-[52px]">
        {extra}
        {alert.type === 'stalled' && (
          <button onClick={() => toast.success(`Nudge sent to ${displayName || alert.person_name}`)}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-colors">
            Send Nudge
          </button>
        )}
        {resolvable && (
          <button onClick={() => resolveMutation.mutate(alert.id)}
            disabled={resolveMutation.isPending}
            className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] text-slate-400 rounded-lg text-xs font-semibold hover:bg-white/[0.06] transition-colors disabled:opacity-40">
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Alerts() {
  const { data: alerts = [],          isLoading: alertsLoading  } = useAlerts()
  const { data: candidates = [],      isLoading: candLoading    } = useCandidates()
  const { data: deadlineAlerts = [] }                              = useDeadlineAlerts()
  const resolveMutation = useResolveAlert()
  const [notifyingId,         setNotifyingId]         = useState(null)
  const [mismatchNotifyingId, setMismatchNotifyingId] = useState(null)
  const [deadlineNotifyingId, setDeadlineNotifyingId] = useState(null)

  const backendAlerts = alerts.filter(a => a.type !== 'expiry')
  const high   = backendAlerts.filter(a => a.severity === 'high')
  const medium = backendAlerts.filter(a => a.severity === 'medium')
  const low    = backendAlerts.filter(a => a.severity === 'low')

  const [hasExpiryAlerts, setHasExpiryAlerts] = useState(false)

  // ── Resolve a candidate from an alert ───────────────────────
  function findCandidateForAlert(alert) {
    if (alert.candidate_id) {
      const byId = candidates.find(c => c.id === alert.candidate_id)
      if (byId) return byId
    }
    if (alert.person_name) {
      return candidates.find(
        c => c.full_name?.toLowerCase().trim() === alert.person_name.toLowerCase().trim()
      ) || null
    }
    return null
  }

  // ── Expiry email handler ─────────────────────────────────────
  const handleNotify = async ({ candidate, doc, daysUntilExpiry, alertId }) => {
    setNotifyingId(alertId)
    try {
      await sendExpiryNotificationEmail({ candidate, doc, daysUntilExpiry })
      toast.success(`📧 ${resolveDocLabel(doc)} expiry notice sent to ${candidate.full_name}`, {
        duration: 5000,
        style: { background: '#0C1120', color: '#E2E8F0', border: '1px solid rgba(20,184,166,0.3)', borderRadius: '12px' },
      })
    } catch (err) {
      toast.error(`Failed to send: ${err.message}`)
    } finally {
      setNotifyingId(null)
    }
  }

  // ── Mismatch email handler ───────────────────────────────────
  const handleMismatchNotify = async ({ candidate, alertMessage, alertId }) => {
    setMismatchNotifyingId(alertId)
    try {
      await sendMismatchNotificationEmail({ candidate, alertMessage })
      toast.success(`📧 Verification failure notice sent to ${candidate.full_name}`, {
        duration: 5000,
        style: { background: '#0C1120', color: '#E2E8F0', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px' },
      })
    } catch (err) {
      toast.error(`Failed to send: ${err.message}`)
    } finally {
      setMismatchNotifyingId(null)
    }
  }

  // ── Deadline email handler ───────────────────────────────────
  const handleDeadlineNotify = async ({ candidate, daysLeft, alertId }) => {
    setDeadlineNotifyingId(alertId)
    try {
      await sendDeadlineNotificationEmail({ candidate, daysLeft })
      const label = daysLeft < 0 ? 'overdue notice' : daysLeft === 0 ? 'same-day reminder' : `${daysLeft}-day deadline reminder`
      toast.success(`📧 Onboarding ${label} sent to ${candidate.full_name}`, {
        duration: 5000,
        style: { background: '#0C1120', color: '#E2E8F0', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px' },
      })
    } catch (err) {
      toast.error(`Failed to send: ${err.message}`)
    } finally {
      setDeadlineNotifyingId(null)
    }
  }

  // ── Build extra actions for backend alert cards ──────────────
  function buildExtra(alert) {
    const isMismatch = alert.type === 'document_mismatch' || alert.type === 'verification_failed'
    if (!isMismatch) return null

    const candidate = findCandidateForAlert(alert)
    const toEmail   = candidate?.personal_email || candidate?.login_email

    if (!candidate || !toEmail) {
      return <span className="text-xs text-slate-600 italic">No email on file</span>
    }

    const isNotifying = mismatchNotifyingId === alert.id
    return (
      <button
        onClick={() => handleMismatchNotify({ candidate, alertMessage: alert.message, alertId: alert.id })}
        disabled={isNotifying}
        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
      >
        {isNotifying
          ? <><span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin inline-block" />Sending…</>
          : '✉️ Notify Candidate'}
      </button>
    )
  }

  if (alertsLoading || candLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading alerts…" />
      </div>
    )
  }

  const hasAnyAlerts = backendAlerts.length > 0 || hasExpiryAlerts || deadlineAlerts.length > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Alerts</h1>
        <p className="text-slate-500 text-sm mt-1">Document expiry, deadlines and onboarding alerts</p>
      </div>

      {/* ── Onboarding Deadline Alerts ──────────────────────── */}
      {deadlineAlerts.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">⏰ Onboarding Deadline</p>
          <div className="space-y-3 sm:space-y-4">
            {deadlineAlerts.map((a, i) => {
              const candidate  = candidates.find(c => c.id === a.candidate_id)
              const toEmail    = candidate?.personal_email || candidate?.login_email
              const isNotifying = deadlineNotifyingId === a.id
              return (
                <AlertCard
                  key={a.id}
                  alert={a}
                  delay={i * 80}
                  resolvable={false}
                  resolveMutation={resolveMutation}
                  resolvedName={a.person_name}
                  extra={
                    toEmail ? (
                      <button
                        onClick={() => handleDeadlineNotify({ candidate, daysLeft: a.daysLeft, alertId: a.id })}
                        disabled={isNotifying}
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {isNotifying
                          ? <><span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin inline-block" />Sending…</>
                          : '✉️ Notify Candidate'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600 italic">No email on file</span>
                    )
                  }
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Document Expiry Alerts ──────────────────────────── */}
      {candidates.length > 0 && (
        <div className={hasExpiryAlerts ? 'mb-6' : ''}>
          {hasExpiryAlerts && (
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">🔴 Document Expiry</p>
          )}
          <div className="space-y-3 sm:space-y-4">
            {candidates.map(c => (
              <CandidateDocAlerts
                key={c.id}
                candidate={c}
                onNotify={handleNotify}
                notifyingId={notifyingId}
                resolveMutation={resolveMutation}
                setHasExpiry={setHasExpiryAlerts}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Backend Alerts (mismatch / stalled / missing) ───── */}
      {high.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">🔴 High Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {high.map((a, i) => (
              <AlertCard key={a.id} alert={a} delay={i * 80} resolveMutation={resolveMutation} extra={buildExtra(a)}
                resolvedName={findCandidateForAlert(a)?.full_name} />
            ))}
          </div>
        </div>
      )}
      {medium.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">🟡 Medium Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {medium.map((a, i) => (
              <AlertCard key={a.id} alert={a} delay={i * 80 + 200} resolveMutation={resolveMutation} extra={buildExtra(a)}
                resolvedName={findCandidateForAlert(a)?.full_name} />
            ))}
          </div>
        </div>
      )}
      {low.length > 0 && (
        <div>
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3">🟢 Low Priority</p>
          <div className="space-y-3 sm:space-y-4">
            {low.map((a, i) => (
              <AlertCard key={a.id} alert={a} delay={i * 80 + 400} resolveMutation={resolveMutation} extra={buildExtra(a)}
                resolvedName={findCandidateForAlert(a)?.full_name} />
            ))}
          </div>
        </div>
      )}

      {!hasAnyAlerts && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-semibold text-slate-300">No active alerts</p>
          <p className="text-sm mt-1">All documents and onboarding are on track</p>
        </div>
      )}
    </div>
  )
}