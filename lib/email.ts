import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Upbuild Coaching <noreply@upbuild.com>'
const SUPPORT_EMAIL = 'michael@upbuild.com'

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendSignupConfirmationEmail({
  studentEmail,
  studentName,
  groupTitle,
  startTimeFormatted,
  facilitatorName,
}: {
  studentEmail: string
  studentName: string
  groupTitle: string
  startTimeFormatted: string
  facilitatorName: string
}) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: `Confirmed: ${groupTitle}`,
    html: `
      <p>You're confirmed for <strong>${groupTitle}</strong>.</p>
      <p><strong>When:</strong> ${startTimeFormatted}</p>
      <p>You'll receive a calendar invite shortly.</p>
    `,
  })
}

export async function sendCancellationNotificationEmail({
  groupTitle,
  startTimeFormatted,
  facilitatorEmail,
  facilitatorName,
  studentEmails,
}: {
  groupTitle: string
  startTimeFormatted: string
  facilitatorEmail: string
  facilitatorName: string
  studentEmails: string[]
}) {
  const recipients = [facilitatorEmail, ...studentEmails].filter(Boolean)
  if (recipients.length === 0) return

  await resend.emails.send({
    from: FROM,
    to: recipients,
    subject: `Canceled: ${groupTitle}`,
    html: `
      <p><strong>${groupTitle}</strong> on ${startTimeFormatted} has been canceled.</p>
    `,
  })
}

export async function sendFullGroupRequestNotification({
  adminEmail,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  requestedRosterCount,
  requestedCapacity,
  currentGroupTitle,
  reason,
  adminRequestUrl,
}: {
  adminEmail: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  requestedRosterCount: number
  requestedCapacity: number
  currentGroupTitle: string | null
  reason: string | null
  adminRequestUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Full group request: ${studentName} → ${requestedGroupTitle}`,
    html: `
      <p><strong>${escHtml(studentName)}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${escHtml(requestedGroupTitle)}<br>
      ${escHtml(requestedGroupFormatted)}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${escHtml(currentGroupTitle)}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${escHtml(reason)}</p>` : ''}
      <p><a href="${adminRequestUrl}" style="background:#2563eb;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Review Request</a></p>
    `,
  })
}

export async function sendFacilitatorRequestNotification({
  facilitatorEmail,
  facilitatorName,
  subject,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  requestedRosterCount,
  requestedCapacity,
  currentGroupTitle,
  reason,
  approveUrl,
  rejectUrl,
}: {
  facilitatorEmail: string
  facilitatorName: string
  subject: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  requestedRosterCount: number
  requestedCapacity: number
  currentGroupTitle: string | null
  reason: string | null
  approveUrl: string
  rejectUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: facilitatorEmail,
    subject,
    html: `
      <p><strong>${escHtml(studentName)}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${escHtml(requestedGroupTitle)}<br>
      ${escHtml(requestedGroupFormatted)}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${escHtml(currentGroupTitle)}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${escHtml(reason)}</p>` : ''}
      <p>
        <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;margin-right:8px;">Approve</a>
        <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Reject</a>
      </p>
      <p style="font-size:12px;color:#6b7280;">Note: The first response wins. You will receive a follow-up once the request is resolved.</p>
    `,
  })
}

export async function sendFullGroupApprovalEmail({
  studentEmail,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  facilitatorName,
}: {
  studentEmail: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  facilitatorName: string
}) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: `Added: ${requestedGroupTitle}`,
    html: `
      <p>You've been added to <strong>${escHtml(requestedGroupTitle)}</strong>.</p>
      <p><strong>When:</strong> ${escHtml(requestedGroupFormatted)}</p>
    `,
  })
}

export async function sendFullGroupRejectionEmail({
  studentEmail,
  studentName,
  requestedGroupTitle,
}: {
  studentEmail: string
  studentName: string
  requestedGroupTitle: string
}) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: 'Full group request update',
    html: `
      <p>Your request to join <strong>${escHtml(requestedGroupTitle)}</strong> was not approved. You remain in your current group.</p>
    `,
  })
}

export async function sendSessionReminderEmail({
  to,
  groupTitle,
  startTimeFormatted,
  zoomLink,
}: {
  to: string[]
  groupTitle: string
  startTimeFormatted: string
  zoomLink?: string | null
}) {
  if (to.length === 0) return

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reminder: ${groupTitle} starts in 24 hours`,
    html: `
      <p><strong>${escHtml(groupTitle)}</strong> starts in about 24 hours.</p>
      <p><strong>When:</strong> ${escHtml(startTimeFormatted)}</p>
      ${zoomLink ? `<p><strong>Zoom link:</strong> <a href="${escHtml(zoomLink)}">${escHtml(zoomLink)}</a></p>` : ''}
    `,
  })
}

export async function sendNoShowCheckEmail({
  facilitatorEmail,
  groupTitle,
  startTimeFormatted,
  students,
}: {
  facilitatorEmail: string
  groupTitle: string
  startTimeFormatted: string
  students: { name: string; noShowUrl: string }[]
}) {
  await resend.emails.send({
    from: FROM,
    to: facilitatorEmail,
    subject: `Attendance: ${groupTitle}`,
    html: `
      <p><strong>${escHtml(groupTitle)}</strong> (${escHtml(startTimeFormatted)}) has ended.</p>
      <p>Everyone is assumed to have attended. Click a name below if they did <strong>not</strong> show up:</p>
      <ul>
        ${students.map(s => `<li><a href="${s.noShowUrl}">${escHtml(s.name)}</a></li>`).join('')}
      </ul>
    `,
  })
}

export async function sendFacilitatorResolutionEmail({
  facilitatorEmail,
  facilitatorName,
  studentName,
  requestedGroupTitle,
  decision,
}: {
  facilitatorEmail: string
  facilitatorName: string
  studentName: string
  requestedGroupTitle: string
  decision: 'approved' | 'rejected'
}) {
  await resend.emails.send({
    from: FROM,
    to: facilitatorEmail,
    subject: 'Full group request resolved',
    html: `
      <p>The full group request for <strong>${escHtml(studentName)}</strong> to join <strong>${escHtml(requestedGroupTitle)}</strong> has been <strong>${decision}</strong>.</p>
    `,
  })
}
