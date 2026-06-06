import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Upbuild Coaching <noreply@upbuild.com>'

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
    subject: `You're signed up: ${groupTitle}`,
    html: `
      <p>Hi ${studentName},</p>
      <p>You're confirmed for <strong>${groupTitle}</strong> with ${facilitatorName}.</p>
      <p><strong>When:</strong> ${startTimeFormatted}</p>
      <p>You'll receive a calendar invite shortly.</p>
      <p>— Upbuild Coaching</p>
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
    subject: `Group session canceled: ${groupTitle}`,
    html: `
      <p>Hi,</p>
      <p>The following group coaching session has been <strong>canceled</strong>:</p>
      <p><strong>${groupTitle}</strong> with ${facilitatorName} on ${startTimeFormatted}</p>
      <p>Please contact michael@upbuild.com if you have questions.</p>
      <p>— Upbuild Coaching</p>
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
      <p><strong>${studentName}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${requestedGroupTitle}<br>
      ${requestedGroupFormatted}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${currentGroupTitle}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p><a href="${adminRequestUrl}" style="background:#2563eb;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Review Request</a></p>
      <p>— Upbuild Coaching</p>
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
      <p>Hi ${facilitatorName},</p>
      <p><strong>${studentName}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${requestedGroupTitle}<br>
      ${requestedGroupFormatted}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${currentGroupTitle}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>
        <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;margin-right:8px;">Approve</a>
        <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Reject</a>
      </p>
      <p style="font-size:12px;color:#6b7280;">Note: The first response wins. You will receive a follow-up once the request is resolved.</p>
      <p>— Upbuild Coaching</p>
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
    subject: `You've been added to ${requestedGroupTitle}`,
    html: `
      <p>Hi ${studentName},</p>
      <p>Your request was approved. You've been added to <strong>${requestedGroupTitle}</strong> with ${facilitatorName}.</p>
      <p><strong>When:</strong> ${requestedGroupFormatted}</p>
      <p>Your calendar invite will be updated shortly.</p>
      <p>— Upbuild Coaching</p>
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
      <p>Hi ${studentName},</p>
      <p>Your request to join <strong>${requestedGroupTitle}</strong> was not approved. You remain in your current group.</p>
      <p>Contact michael@upbuild.com if you have questions.</p>
      <p>— Upbuild Coaching</p>
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
      <p>Hi ${facilitatorName},</p>
      <p>The full group request for <strong>${studentName}</strong> to join <strong>${requestedGroupTitle}</strong> has been <strong>${decision}</strong>.</p>
      <p>— Upbuild Coaching</p>
    `,
  })
}
