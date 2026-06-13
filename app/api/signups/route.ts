import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { addAttendeeToEvent } from '@/lib/calendar'
import { sendSignupConfirmationEmail } from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupSessionId } = await request.json()

  const { data: group } = await adminClient
    .from('group_sessions')
    .select('*, rounds(signup_status), signups(id, status)')
    .eq('id', groupSessionId)
    .single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.status !== 'published') return NextResponse.json({ error: 'Group is not available' }, { status: 400 })

  const round = group.rounds
  if (round.signup_status === 'closed') {
    return NextResponse.json({ error: 'Signup is closed for this round' }, { status: 400 })
  }

  const { data: existingPrimary } = await adminClient
    .from('signups')
    .select('id')
    .eq('student_id', user.id)
    .eq('round_id', group.round_id)
    .eq('status', 'confirmed')
    .eq('signup_type', 'primary')
    .maybeSingle()

  if (existingPrimary && round.signup_status !== 'extra_signups_open') {
    return NextResponse.json({ error: 'You already have a signup in this round' }, { status: 400 })
  }

  const confirmedCount = (group.signups ?? []).filter((s: any) => s.status === 'confirmed').length
  if (confirmedCount >= group.capacity) {
    await adminClient.from('group_sessions').update({ status: 'full' }).eq('id', groupSessionId)
    return NextResponse.json({ error: 'Group is full' }, { status: 400 })
  }

  const signupType = existingPrimary ? 'additional' : 'primary'
  const { data: signup, error: signupError } = await adminClient
    .from('signups')
    .insert({
      student_id: user.id,
      group_session_id: groupSessionId,
      round_id: group.round_id,
      status: 'confirmed',
      signup_type: signupType,
    })
    .select()
    .single()

  if (signupError) return NextResponse.json({ error: signupError.message }, { status: 500 })

  if (confirmedCount + 1 >= group.capacity) {
    await adminClient.from('group_sessions').update({ status: 'full' }).eq('id', groupSessionId)
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'signup.created',
    entity_type: 'signup',
    entity_id: signup.id,
    metadata: { group_session_id: groupSessionId, signup_type: signupType },
  })

  if (group.calendar_event_id) {
    const { data: student } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (student) {
      addAttendeeToEvent({
        calendarEventId: group.calendar_event_id,
        email: student.email,
        displayName: student.name,
      }).catch((err: unknown) => console.error('Calendar add failed', err))

      const { data: facilitator } = await adminClient
        .from('users')
        .select('name')
        .eq('id', group.facilitator_id)
        .single()

      if (process.env.SEND_SIGNUP_CONFIRMATION_EMAIL === 'true') {
        sendSignupConfirmationEmail({
          studentEmail: student.email,
          studentName: student.name,
          groupTitle: group.title,
          startTimeFormatted: formatInTimeZone(
            new Date(group.start_time_utc),
            group.original_timezone,
            'MMMM d, yyyy h:mm a zzz'
          ),
          facilitatorName: facilitator?.name ?? '',
        }).catch((err: unknown) => console.error('Email failed', err))
      }
    }
  }

  return NextResponse.json({ signup })
}
