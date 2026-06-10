import { NextResponse } from 'next/server'
import { verifyNoShowToken } from '@/lib/tokens'
import { adminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let payload
  try {
    payload = verifyNoShowToken(token)
  } catch {
    return NextResponse.redirect(`${baseUrl}/no-show/result?outcome=invalid`)
  }

  const { data: signup } = await adminClient
    .from('signups')
    .select('id, status')
    .eq('id', payload.signupId)
    .single()

  if (!signup) {
    return NextResponse.redirect(`${baseUrl}/no-show/result?outcome=invalid`)
  }

  if (signup.status !== 'confirmed') {
    return NextResponse.redirect(`${baseUrl}/no-show/result?outcome=already_marked`)
  }

  await adminClient
    .from('signups')
    .update({ status: 'no_show' })
    .eq('id', signup.id)

  return NextResponse.redirect(`${baseUrl}/no-show/result?outcome=marked`)
}
