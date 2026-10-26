'use server'

import { requireAdmin } from '@/lib/auth'
import { findInvitesMissingZoom } from '@/lib/system-check'
import { updateEventZoomLink } from '@/lib/calendar'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { adminClient } from '@/lib/supabase/admin'
import { sendSessionReminderEmail, sendNoShowCheckEmail } from '@/lib/email'

// Adds the facilitator's Zoom link to upcoming invites that lack it, without emailing guests
export async function addMissingZoomLinks() {
  await requireAdmin()
  let fixed = 0
  const failures: string[] = []
  try {
    for (const invite of await findInvitesMissingZoom()) {
      try {
        await updateEventZoomLink(invite.calendarEventId, invite.zoomLink, { notify: false })
        fixed++
      } catch (err) {
        console.error('Zoom link backfill failed for group', invite.groupId, err)
        failures.push(`${invite.title}: ${googleErrorMessage(err)}`)
      }
    }
  } catch (err) {
    console.error('Zoom link backfill could not list invites', err)
    failures.push(`Could not read the invites: ${googleErrorMessage(err)}`)
  }
  revalidatePath('/admin/system')
  const params = new URLSearchParams({ zoom: 'done', fixed: String(fixed) })
  if (failures.length) params.set('errors', failures.join('\n'))
  redirect(`/admin/system?${params}`)
}

function googleErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string | { message?: string } } }; message?: string }
  const apiError = e.response?.data?.error
  return (typeof apiError === 'string' ? apiError : apiError?.message) ?? e.message ?? 'unknown error'
}

// Sends the admin a sample student reminder and a sample facilitator attendance email.
// The attendance links are harmless: they only open the app.
export async function sendTestEmails() {
  const userId = await requireAdmin()
  const { data: me } = await adminClient.from('users').select('email, timezone, zoom_link').eq('id', userId).single()
  if (!me?.email) redirect('/admin/system?test=failed')

  const startTimeFormatted = formatInTimeZone(new Date(Date.now() + 24 * 60 * 60 * 1000), me.timezone, 'MMM d, yyyy h:mm a zzz')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  try {
    await sendSessionReminderEmail({
      to: [me.email],
      groupTitle: '[TEST] Group Coaching Round 1 Sample',
      startTimeFormatted,
      zoomLink: me.zoom_link ?? 'https://zoom.us/j/0000000000',
    })
    await sendNoShowCheckEmail({
      facilitatorEmail: me.email,
      groupTitle: '[TEST] Group Coaching Round 1 Sample',
      startTimeFormatted,
      students: ['Sample Student A', 'Sample Student B'].map(name => ({ name, noShowUrl: appUrl })),
    })
  } catch (err) {
    console.error('Test emails failed', err)
    redirect('/admin/system?test=failed')
  }
  redirect(`/admin/system?test=sent&to=${encodeURIComponent(me.email)}`)
}
