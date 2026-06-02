import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { removeAttendeeFromEvent } from '@/lib/calendar'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: signup } = await adminClient
    .from('signups')
    .select('*, group_sessions(calendar_event_id, capacity, status, round_id)')
    .eq('id', id)
    .single()

  if (!signup) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (signup.student_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await adminClient
    .from('signups')
    .update({ status: 'canceled' })
    .eq('id', id)

  const group = signup.group_sessions
  if (group.status === 'full') {
    await adminClient
      .from('group_sessions')
      .update({ status: 'published' })
      .eq('id', signup.group_session_id)
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'signup.canceled',
    entity_type: 'signup',
    entity_id: id,
    metadata: { group_session_id: signup.group_session_id },
  })

  if (group.calendar_event_id) {
    const { data: student } = await adminClient
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    if (student) {
      removeAttendeeFromEvent({
        calendarEventId: group.calendar_event_id,
        email: student.email,
      }).catch((err: unknown) => console.error('Calendar remove failed', err))
    }
  }

  return NextResponse.json({ ok: true })
}
