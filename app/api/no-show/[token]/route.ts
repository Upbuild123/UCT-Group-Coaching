import { NextResponse } from 'next/server'
import { verifyNoShowToken } from '@/lib/tokens'
import { adminClient } from '@/lib/supabase/admin'
import { confirmPage } from '@/lib/confirm-page'

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function result(outcome: string) {
  // 303 so the browser follows the POST with a GET
  return NextResponse.redirect(`${baseUrl()}/no-show/result?outcome=${outcome}`, 303)
}

async function loadSignup(token: string) {
  let payload
  try {
    payload = verifyNoShowToken(token)
  } catch {
    return null
  }

  const { data: signup } = await adminClient
    .from('signups')
    .select('id, status, users!student_id(name), group_sessions(title)')
    .eq('id', payload.signupId)
    .single()

  return signup
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const signup = await loadSignup(token)
  if (!signup) return result('invalid')
  if (signup.status !== 'confirmed') return result('already_marked')

  const studentName = (signup.users as unknown as { name: string } | null)?.name ?? 'this student'
  const groupTitle = (signup.group_sessions as unknown as { title: string } | null)?.title ?? 'this session'

  return confirmPage({
    heading: 'Mark as no-show?',
    message: `${studentName} will be marked as not attending ${groupTitle}.`,
    buttonLabel: 'Mark as no-show',
    danger: true,
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const signup = await loadSignup(token)
  if (!signup) return result('invalid')
  if (signup.status !== 'confirmed') return result('already_marked')

  await adminClient
    .from('signups')
    .update({ status: 'no_show' })
    .eq('id', signup.id)

  return result('marked')
}
