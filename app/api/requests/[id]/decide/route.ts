import { NextResponse } from 'next/server'
import { verifyDecisionToken } from '@/lib/tokens'
import { processDecision, getFacilitatorField } from '@/lib/requests'
import { adminClient } from '@/lib/supabase/admin'
import { confirmPage } from '@/lib/confirm-page'

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function result(outcome: string) {
  // 303 so the browser follows the POST with a GET
  return NextResponse.redirect(`${baseUrl()}/requests/result?outcome=${outcome}`, 303)
}

function readToken(request: Request, id: string) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return null
  try {
    const payload = verifyDecisionToken(token)
    return payload.requestId === id ? payload : null
  } catch {
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const payload = readToken(request, id)
  if (!payload) return result('invalid')

  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('status, users!student_id(name), group_sessions!requested_group_session_id(title)')
    .eq('id', id)
    .single()

  if (!fgr) return result('invalid')
  if (fgr.status !== 'pending') return result('already_resolved')

  const studentName = (fgr.users as unknown as { name: string } | null)?.name ?? 'This student'
  const groupTitle = (fgr.group_sessions as unknown as { title: string } | null)?.title ?? 'the requested group'
  const approving = payload.decision === 'approved'

  return confirmPage({
    heading: approving ? 'Approve this request?' : 'Reject this request?',
    message: `${studentName} asked to join ${groupTitle}, which is full.`,
    buttonLabel: approving ? 'Approve request' : 'Reject request',
    danger: !approving,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const payload = readToken(request, id)
  if (!payload) return result('invalid')

  const facilitatorField = await getFacilitatorField(id, payload.actorUserId)

  try {
    const { alreadyResolved } = await processDecision({
      requestId: id,
      decision: payload.decision,
      actorUserId: payload.actorUserId,
      keepCurrentSlot: false,
      facilitatorField,
    })
    if (alreadyResolved) return result('already_resolved')
  } catch (err) {
    console.error('processDecision failed:', err)
    return result('error')
  }

  return result(payload.decision)
}
