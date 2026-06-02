'use server'

import { adminClient } from '@/lib/supabase/admin'
import { cancelCalendarEvent } from '@/lib/calendar'
import { sendCancellationNotificationEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { formatInTimeZone } from 'date-fns-tz'

export async function cancelGroup(groupId: string) {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('*, users!facilitator_id(name, email), signups(student_id, status, users!student_id(email))')
    .eq('id', groupId)
    .single()

  if (!group) return

  await adminClient.from('group_sessions').update({ status: 'canceled' }).eq('id', groupId)

  const studentEmails = (group.signups ?? [])
    .filter((s: any) => s.status === 'confirmed')
    .map((s: any) => s.users?.email)
    .filter(Boolean)

  if (group.calendar_event_id) {
    cancelCalendarEvent(group.calendar_event_id).catch((err: unknown) => console.error('Calendar cancel failed', err))
  }

  sendCancellationNotificationEmail({
    groupTitle: group.title,
    startTimeFormatted: formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz'),
    facilitatorEmail: group.users?.email ?? '',
    facilitatorName: group.users?.name ?? '',
    studentEmails,
  }).catch((err: unknown) => console.error('Cancellation email failed', err))

  revalidatePath(`/admin/rounds/${group.round_id}`)
}
