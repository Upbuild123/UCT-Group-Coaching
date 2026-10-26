import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { fromZonedTime } from 'date-fns-tz'
import { rescheduleCalendarEvent } from '@/lib/calendar'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let dateTimeLocal: string, timezone: string
  try {
    const body = await request.json() as { dateTimeLocal?: string; timezone?: string }
    dateTimeLocal = body.dateTimeLocal ?? ''
    timezone = body.timezone ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const startUtc = dateTimeLocal && timezone ? fromZonedTime(dateTimeLocal, timezone) : null
  if (!startUtc || isNaN(startUtc.getTime())) {
    return NextResponse.json({ error: 'Choose a valid date, time and timezone' }, { status: 400 })
  }
  if (startUtc <= new Date()) {
    return NextResponse.json({ error: 'The new time is in the past' }, { status: 400 })
  }

  const { data: group } = await adminClient
    .from('group_sessions')
    .select('start_time_utc, end_time_utc, calendar_event_id, status')
    .eq('id', groupId)
    .single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.status === 'canceled') return NextResponse.json({ error: 'This group has been canceled' }, { status: 400 })

  // Keep the session's length
  const durationMs = new Date(group.end_time_utc).getTime() - new Date(group.start_time_utc).getTime()
  const endUtc = new Date(startUtc.getTime() + durationMs)

  // Move the invite first, so the app never shows a time the invites don't
  if (group.calendar_event_id) {
    try {
      await rescheduleCalendarEvent(group.calendar_event_id, startUtc, endUtc)
    } catch (err) {
      console.error('Calendar reschedule failed for group', groupId, err)
      return NextResponse.json({ error: 'Could not update the calendar invite, so the time was not changed. Check the System check page.' }, { status: 502 })
    }
  }

  const { error } = await adminClient
    .from('group_sessions')
    .update({
      start_time_utc: startUtc.toISOString(),
      end_time_utc: endUtc.toISOString(),
      original_timezone: timezone,
      // Reminder and no-show emails should follow the new time
      reminder_sent_at: null,
      no_show_email_sent_at: null,
    })
    .eq('id', groupId)

  if (error) {
    console.error('Reschedule save failed for group', groupId, error)
    return NextResponse.json({ error: 'The invite was moved but the new time could not be saved. Try again.' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'group_session.rescheduled',
    entity_type: 'group_session',
    entity_id: groupId,
    metadata: { from: group.start_time_utc, to: startUtc.toISOString() },
  })

  return NextResponse.json({ ok: true })
}
