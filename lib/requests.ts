import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { addAttendeeToEvent, removeAttendeeFromEvent } from '@/lib/calendar'
import {
  sendFullGroupApprovalEmail,
  sendFullGroupRejectionEmail,
  sendFacilitatorResolutionEmail,
} from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

export async function processDecision({
  requestId,
  decision,
  actorUserId,
  keepCurrentSlot = false,
  facilitatorField,
}: {
  requestId: string
  decision: 'approved' | 'rejected'
  actorUserId: string | null
  keepCurrentSlot?: boolean
  facilitatorField?: 'new_facilitator_decision' | 'old_facilitator_decision' | null
}): Promise<{ alreadyResolved: boolean }> {
  const extraFields: Record<string, string> = {}
  if (facilitatorField) extraFields[facilitatorField] = decision

  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .update({
      status: decision,
      decided_by_user_id: actorUserId,
      decided_at: new Date().toISOString(),
      ...extraFields,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (!fgr) return { alreadyResolved: true }

  const [studentRes, requestedGroupRes, currentGroupRes] = await Promise.all([
    adminClient.from('users').select('id, name, email').eq('id', fgr.student_id).single(),
    adminClient
      .from('group_sessions')
      .select('id, title, start_time_utc, original_timezone, capacity, status, calendar_event_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
      .eq('id', fgr.requested_group_session_id)
      .single(),
    fgr.current_group_session_id
      ? adminClient
          .from('group_sessions')
          .select('id, title, start_time_utc, original_timezone, capacity, status, calendar_event_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
          .eq('id', fgr.current_group_session_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const student = studentRes.data
  const requestedGroup = requestedGroupRes.data
  if (!student || !requestedGroup) throw new Error('Failed to load request data')
  const currentGroup = currentGroupRes.data

  if (decision === 'rejected') {
    sendFullGroupRejectionEmail({
      studentEmail: student.email,
      studentName: student.name,
      requestedGroupTitle: requestedGroup.title,
    }).catch((err: unknown) => console.error('Rejection email failed', err))

    const requestedFacilitatorOnReject = (requestedGroup as any).users
    const currentFacilitatorOnReject = currentGroup ? (currentGroup as any).users : null
    const facilitatorsOnReject: Array<{ id: string; name: string; email: string }> = []
    if (requestedFacilitatorOnReject) facilitatorsOnReject.push(requestedFacilitatorOnReject)
    if (currentFacilitatorOnReject && currentFacilitatorOnReject.id !== requestedFacilitatorOnReject?.id) {
      facilitatorsOnReject.push(currentFacilitatorOnReject)
    }
    for (const f of facilitatorsOnReject) {
      sendFacilitatorResolutionEmail({
        facilitatorEmail: f.email,
        facilitatorName: f.name,
        studentName: student.name,
        requestedGroupTitle: requestedGroup.title,
        decision: 'rejected',
      }).catch((err: unknown) => console.error('Facilitator rejection notification failed', err))
    }

    await adminClient.from('audit_log').insert({
      actor_user_id: actorUserId,
      action: 'full_group_request.rejected',
      entity_type: 'full_group_request',
      entity_id: requestId,
      metadata: {},
    })

    return { alreadyResolved: false }
  }

  // APPROVED: insert new signup
  const { error: signupError } = await adminClient.from('signups').insert({
    student_id: student.id,
    group_session_id: requestedGroup.id,
    round_id: fgr.round_id,
    status: 'confirmed',
    signup_type: 'admin_override',
  })
  if (signupError) throw new Error(`Failed to insert signup: ${signupError.message}`)

  const newCount = (requestedGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length + 1
  if (newCount >= requestedGroup.capacity) {
    await adminClient.from('group_sessions').update({ status: 'full' }).eq('id', requestedGroup.id)
  }

  if (currentGroup && !keepCurrentSlot) {
    await adminClient
      .from('signups')
      .update({ status: 'moved' })
      .eq('student_id', student.id)
      .eq('group_session_id', currentGroup.id)
      .eq('status', 'confirmed')

    // Re-open old group if removing this student drops it below capacity
    const oldConfirmed = (currentGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length
    if (currentGroup.status === 'full' && oldConfirmed - 1 < currentGroup.capacity) {
      await adminClient.from('group_sessions').update({ status: 'published' }).eq('id', currentGroup.id)
    }

    if (currentGroup.calendar_event_id) {
      removeAttendeeFromEvent({ calendarEventId: currentGroup.calendar_event_id, email: student.email })
        .catch((err: unknown) => console.error('Remove from old calendar failed', err))
    }
  }

  if (requestedGroup.calendar_event_id) {
    addAttendeeToEvent({
      calendarEventId: requestedGroup.calendar_event_id,
      email: student.email,
      displayName: student.name,
    }).catch((err: unknown) => console.error('Add to new calendar failed', err))
  }

  const requestedFormatted = formatInTimeZone(
    new Date(requestedGroup.start_time_utc),
    requestedGroup.original_timezone,
    'MMMM d, yyyy h:mm a zzz'
  )

  const requestedFacilitator = (requestedGroup as any).users
  sendFullGroupApprovalEmail({
    studentEmail: student.email,
    studentName: student.name,
    requestedGroupTitle: requestedGroup.title,
    requestedGroupFormatted: requestedFormatted,
    facilitatorName: requestedFacilitator?.name ?? '',
  }).catch((err: unknown) => console.error('Approval email failed', err))

  const facilitatorsToNotify: Array<{ id: string; name: string; email: string }> = []
  if (requestedFacilitator) facilitatorsToNotify.push(requestedFacilitator)
  const currentFacilitator = currentGroup ? (currentGroup as any).users : null
  if (currentFacilitator && currentFacilitator.id !== requestedFacilitator?.id) {
    facilitatorsToNotify.push(currentFacilitator)
  }

  for (const f of facilitatorsToNotify) {
    sendFacilitatorResolutionEmail({
      facilitatorEmail: f.email,
      facilitatorName: f.name,
      studentName: student.name,
      requestedGroupTitle: requestedGroup.title,
      decision: 'approved',
    }).catch((err: unknown) => console.error('Facilitator resolution email failed', err))
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: actorUserId,
    action: 'full_group_request.approved',
    entity_type: 'full_group_request',
    entity_id: requestId,
    metadata: { keep_current_slot: keepCurrentSlot },
  })

  return { alreadyResolved: false }
}

export async function getFacilitatorField(
  requestId: string,
  actorUserId: string
): Promise<'new_facilitator_decision' | 'old_facilitator_decision' | null> {
  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('requested_group_session_id, current_group_session_id')
    .eq('id', requestId)
    .single()

  if (!fgr) return null

  const { data: requestedGroup } = await adminClient
    .from('group_sessions')
    .select('facilitator_id')
    .eq('id', fgr.requested_group_session_id)
    .single()

  if (requestedGroup?.facilitator_id === actorUserId) return 'new_facilitator_decision'

  if (fgr.current_group_session_id) {
    const { data: currentGroup } = await adminClient
      .from('group_sessions')
      .select('facilitator_id')
      .eq('id', fgr.current_group_session_id)
      .single()
    if (currentGroup?.facilitator_id === actorUserId) return 'old_facilitator_decision'
  }

  return null
}
