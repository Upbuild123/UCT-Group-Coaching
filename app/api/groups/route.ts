import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { addMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { createCalendarEvent } from '@/lib/calendar'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { slots } = body as {
    slots: Array<{
      roundId: string
      facilitatorId: string
      title: string
      notes?: string
      dateTimeLocal: string
      timezone: string
      capacity: number
    }>
  }

  const created = []

  for (const slot of slots) {
    const startUtc = fromZonedTime(slot.dateTimeLocal, slot.timezone)
    const endUtc = addMinutes(startUtc, 60)

    const { data: group, error } = await adminClient
      .from('group_sessions')
      .insert({
        round_id: slot.roundId,
        facilitator_id: slot.facilitatorId,
        title: slot.title,
        notes: slot.notes ?? null,
        start_time_utc: startUtc.toISOString(),
        end_time_utc: endUtc.toISOString(),
        original_timezone: slot.timezone,
        capacity: slot.capacity,
        status: 'draft',
      })
      .select()
      .single()

    if (error) continue

    try {
      const { data: facilitator } = await adminClient
        .from('users')
        .select('name, email')
        .eq('id', slot.facilitatorId)
        .single()

      const calendarEventId = await createCalendarEvent({
        title: slot.title,
        startUtc,
        endUtc,
        facilitatorEmail: facilitator!.email,
        facilitatorName: facilitator!.name,
      })

      await adminClient
        .from('group_sessions')
        .update({ calendar_event_id: calendarEventId, status: 'published' })
        .eq('id', group.id)

      group.calendar_event_id = calendarEventId
      group.status = 'published'
    } catch (calError) {
      console.error('Calendar event creation failed for group', group.id, calError)
    }

    created.push(group)
  }

  return NextResponse.json({ created })
}
