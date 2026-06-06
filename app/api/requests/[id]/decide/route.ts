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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

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

  const { alreadyResolved } = await processDecision({
    requestId: id,
    decision: payload.decision,
    actorUserId: payload.actorUserId,
    keepCurrentSlot: false,
    facilitatorField,
  })

  if (alreadyResolved) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=already_resolved`)
  }

  return NextResponse.redirect(`${baseUrl}/requests/result?outcome=${payload.decision}`)
}
