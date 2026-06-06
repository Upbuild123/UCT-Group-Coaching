import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createDecisionToken } from '@/lib/tokens'
import {
  sendFullGroupRequestNotification,
  sendFacilitatorRequestNotification,
} from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupSessionId, reason } = await request.json()

  const { data: group } = await adminClient
    .from('group_sessions')
    .select('id, title, start_time_utc, original_timezone, capacity, status, round_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
    .eq('id', groupSessionId)
    .single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.status !== 'full') return NextResponse.json({ error: 'Group is not full' }, { status: 400 })

  const { data: existing } = await adminClient
    .from('full_group_requests')
    .select('id')
    .eq('student_id', user.id)
    .eq('requested_group_session_id', groupSessionId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request for this group' }, { status: 400 })
  }

  // Find student's current primary signup in this round (if any)
  const { data: currentSignup } = await adminClient
    .from('signups')
    .select('group_session_id, group_sessions(id, title, start_time_utc, original_timezone, users!facilitator_id(id, name, email))')
    .eq('student_id', user.id)
    .eq('round_id', group.round_id)
    .eq('status', 'confirmed')
    .eq('signup_type', 'primary')
    .maybeSingle()

  const currentGroupSessionId = currentSignup?.group_session_id ?? null

  const { data: fgr, error } = await adminClient
    .from('full_group_requests')
    .insert({
      student_id: user.id,
      round_id: group.round_id,
      current_group_session_id: currentGroupSessionId,
      requested_group_session_id: groupSessionId,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [studentRes, adminRes] = await Promise.all([
    adminClient.from('users').select('name, email').eq('id', user.id).single(),
    adminClient.from('users').select('email').eq('role', 'admin').single(),
  ])

  const student = studentRes.data!
  const adminEmail = adminRes.data?.email
  const requestedFacilitator = (group as any).users as { id: string; name: string; email: string }
  const currentGroup = currentSignup ? (currentSignup as any).group_sessions : null
  const currentFacilitator = currentGroup ? currentGroup.users : null

  const requestedGroupFormatted = formatInTimeZone(
    new Date(group.start_time_utc),
    group.original_timezone,
    'MMMM d, yyyy h:mm a zzz'
  )
  const requestedRosterCount = (group.signups ?? []).filter((s: any) => s.status === 'confirmed').length

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (adminEmail) {
    sendFullGroupRequestNotification({
      adminEmail,
      studentName: student.name,
      requestedGroupTitle: group.title,
      requestedGroupFormatted,
      requestedRosterCount,
      requestedCapacity: group.capacity,
      currentGroupTitle: currentGroup?.title ?? null,
      reason: reason ?? null,
      adminRequestUrl: `${baseUrl}/admin/requests/${fgr.id}`,
    }).catch((err: unknown) => console.error('Admin email failed', err))
  }

  const approveTokenRequested = createDecisionToken(fgr.id, 'approved', requestedFacilitator.id)
  const rejectTokenRequested = createDecisionToken(fgr.id, 'rejected', requestedFacilitator.id)

  sendFacilitatorRequestNotification({
    facilitatorEmail: requestedFacilitator.email,
    facilitatorName: requestedFacilitator.name,
    subject: `Full group request for your session: ${group.title}`,
    studentName: student.name,
    requestedGroupTitle: group.title,
    requestedGroupFormatted,
    requestedRosterCount,
    requestedCapacity: group.capacity,
    currentGroupTitle: currentGroup?.title ?? null,
    reason: reason ?? null,
    approveUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${approveTokenRequested}`,
    rejectUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${rejectTokenRequested}`,
  }).catch((err: unknown) => console.error('Requested facilitator email failed', err))

  if (currentFacilitator && currentFacilitator.id !== requestedFacilitator.id) {
    const approveTokenCurrent = createDecisionToken(fgr.id, 'approved', currentFacilitator.id)
    const rejectTokenCurrent = createDecisionToken(fgr.id, 'rejected', currentFacilitator.id)

    sendFacilitatorRequestNotification({
      facilitatorEmail: currentFacilitator.email,
      facilitatorName: currentFacilitator.name,
      subject: `Transfer request from your session: ${student.name}`,
      studentName: student.name,
      requestedGroupTitle: group.title,
      requestedGroupFormatted,
      requestedRosterCount,
      requestedCapacity: group.capacity,
      currentGroupTitle: currentGroup?.title ?? null,
      reason: reason ?? null,
      approveUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${approveTokenCurrent}`,
      rejectUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${rejectTokenCurrent}`,
    }).catch((err: unknown) => console.error('Current facilitator email failed', err))
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'full_group_request.created',
    entity_type: 'full_group_request',
    entity_id: fgr.id,
    metadata: { requested_group_session_id: groupSessionId },
  })

  return NextResponse.json({ requestId: fgr.id })
}
