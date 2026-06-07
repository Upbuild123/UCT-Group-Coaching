import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { removeAttendeeFromEvent } from '@/lib/calendar'

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string; signupId: string }> }
) {
  const { groupId, signupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Validate signup belongs to this group
  const { data: signup } = await adminClient
    .from('signups')
    .select('id, student_id, group_session_id')
    .eq('id', signupId)
    .eq('group_session_id', groupId)
    .maybeSingle()

  if (!signup) return NextResponse.json({ error: 'Signup not found' }, { status: 404 })

  // Get student email for calendar
  const { data: student } = await adminClient
    .from('users')
    .select('email')
    .eq('id', signup.student_id)
    .maybeSingle()

  await adminClient.from('signups').update({ status: 'canceled' }).eq('id', signupId)
  await recalculateStatus(groupId)

  // Calendar fire-and-forget
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('calendar_event_id')
    .eq('id', groupId)
    .single()

  if (group?.calendar_event_id && student?.email) {
    removeAttendeeFromEvent({
      calendarEventId: group.calendar_event_id,
      email: student.email,
    }).catch((err: unknown) => console.error('Calendar remove failed', err))
  }

  return NextResponse.json({ ok: true })
}
