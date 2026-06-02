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
