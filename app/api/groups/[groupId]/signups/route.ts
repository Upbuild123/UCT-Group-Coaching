import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { addAttendeeToEvent } from '@/lib/calendar'
import { sendFullGroupApprovalEmail } from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

async function recalculateStatus(groupId: string) {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('capacity, status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const newStatus = confirmed >= group.capacity ? 'full' : 'published'
  await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { studentId } = await request.json() as { studentId: string }
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  // Check not already confirmed
  const { data: existing } = await adminClient
    .from('signups')
    .select('id')
    .eq('group_session_id', groupId)
    .eq('student_id', studentId)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Student already in this group' }, { status: 400 })

  // Load group and student
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('*, users!facilitator_id(name, email), round_id, calendar_event_id')
    .eq('id', groupId)
    .single()

  const { data: student } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('id', studentId)
    .single()

  if (!group || !student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Create signup
  await adminClient.from('signups').insert({
    student_id: studentId,
    group_session_id: groupId,
    round_id: group.round_id,
    status: 'confirmed',
    signup_type: 'admin_override',
  })

  await recalculateStatus(groupId)

  // Calendar + email fire-and-forget
  if (group.calendar_event_id) {
    addAttendeeToEvent({
      calendarEventId: group.calendar_event_id,
      email: student.email,
      displayName: student.name,
    }).catch((err: unknown) => console.error('Calendar add failed', err))
  }

  sendFullGroupApprovalEmail({
    studentEmail: student.email,
    studentName: student.name,
    requestedGroupTitle: group.title,
    requestedGroupFormatted: formatInTimeZone(
      new Date(group.start_time_utc),
      group.original_timezone,
      'MMM d, yyyy h:mm a zzz'
    ),
    facilitatorName: group.users?.name ?? '',
  }).catch((err: unknown) => console.error('Approval email failed', err))

  return NextResponse.json({ ok: true })
}
