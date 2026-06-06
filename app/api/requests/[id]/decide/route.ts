import { NextResponse } from 'next/server'
import { verifyDecisionToken } from '@/lib/tokens'
import { processDecision, getFacilitatorField } from '@/lib/requests'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  let payload
  try {
    payload = verifyDecisionToken(token)
  } catch {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  if (payload.requestId !== id) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  const facilitatorField = await getFacilitatorField(id, payload.actorUserId)

  let alreadyResolved = false
  try {
    const result = await processDecision({
      requestId: id,
      decision: payload.decision,
      actorUserId: payload.actorUserId,
      keepCurrentSlot: false,
      facilitatorField,
    })
    alreadyResolved = result.alreadyResolved
  } catch (err) {
    console.error('processDecision failed:', err)
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=error`)
  }

  if (alreadyResolved) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=already_resolved`)
  }

  return NextResponse.redirect(`${baseUrl}/requests/result?outcome=${payload.decision}`)
}
