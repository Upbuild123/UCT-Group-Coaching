'use server'

import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { after } from 'next/server'
import { cancelCalendarEvent, createCalendarEvent } from '@/lib/calendar'
import { sendCancellationNotificationEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { formatInTimeZone } from 'date-fns-tz'

// Groups are left in draft when their calendar event could not be created, so publishing
// retries it; a group is only published once it has an event to invite students to.
async function publishWithCalendarEvent(groupId: string): Promise<void> {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('id, title, start_time_utc, end_time_utc, calendar_event_id, users!facilitator_id(name, email, zoom_link)')
    .eq('id', groupId)
    .eq('status', 'draft')
    .single()

  if (!group) return

  let calendarEventId = group.calendar_event_id
  if (!calendarEventId) {
    const facilitator = group.users as unknown as { name: string; email: string; zoom_link: string | null }
    try {
      calendarEventId = await createCalendarEvent({
        title: group.title,
        startUtc: new Date(group.start_time_utc),
        endUtc: new Date(group.end_time_utc),
        facilitatorEmail: facilitator.email,
        facilitatorName: facilitator.name,
        zoomLink: facilitator.zoom_link,
      })
    } catch (err) {
      console.error('Calendar event creation failed for group', groupId, err)
      return
    }
  }

  await adminClient
    .from('group_sessions')
    .update({ status: 'published', calendar_event_id: calendarEventId })
    .eq('id', groupId)
}

export async function publishGroup(groupId: string) {
  await requireAdmin()
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('round_id')
    .eq('id', groupId)
    .single()

  if (!group) return

  await publishWithCalendarEvent(groupId)
  revalidatePath(`/admin/rounds/${group.round_id}`)
}

export async function publishAllDraftGroups(roundId: string) {
  await requireAdmin()
  const { data: drafts } = await adminClient
    .from('group_sessions')
    .select('id')
    .eq('round_id', roundId)
    .eq('status', 'draft')

  for (const draft of drafts ?? []) {
    await publishWithCalendarEvent(draft.id)
  }
  revalidatePath(`/admin/rounds/${roundId}`)
}

export async function cancelGroup(groupId: string) {
  await requireAdmin()
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('*, users!facilitator_id(name, email), signups(student_id, status, users!student_id(email))')
    .eq('id', groupId)
    .single()

  if (!group) return
  if (group.status === 'canceled') return

  await adminClient.from('group_sessions').update({ status: 'canceled' }).eq('id', groupId)

  const studentEmails = (group.signups ?? [])
    .filter((s: any) => s.status === 'confirmed')
    .map((s: any) => s.users?.email)
    .filter(Boolean)

  if (group.calendar_event_id) {
    after(() =>
      cancelCalendarEvent(group.calendar_event_id).catch((err: unknown) => console.error('Calendar cancel failed', err))
    )
  }

  after(() =>

    sendCancellationNotificationEmail({
      groupTitle: group.title,
      startTimeFormatted: formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz'),
      facilitatorEmail: group.users?.email ?? '',
      facilitatorName: group.users?.name ?? '',
      studentEmails,
    }).catch((err: unknown) => console.error('Cancellation email failed', err))

  )

  revalidatePath(`/admin/rounds/${group.round_id}`)
}
