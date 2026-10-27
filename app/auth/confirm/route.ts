import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { confirmPage } from '@/lib/confirm-page'

// Sign-in links that work on any device: they carry a one-time token hash instead of relying on
// a code tied to the browser that requested the link. Opening the link only shows a button
// (mail scanners that open links can't use up the token); signing in happens on the POST.

const ALLOWED_TYPES: EmailOtpType[] = ['email', 'magiclink']

function readLink(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'email') as EmailOtpType
  if (!tokenHash || !ALLOWED_TYPES.includes(type)) return null
  return { tokenHash, type }
}

function toLogin(request: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url), 303)
}

export async function GET(request: NextRequest) {
  if (!readLink(request)) return toLogin(request, 'This sign-in link is invalid. Please request a new one.')
  return confirmPage({
    heading: 'Sign in to Group Coaching',
    message: 'Click the button below to finish signing in.',
    buttonLabel: 'Sign in',
  })
}

export async function POST(request: NextRequest) {
  const link = readLink(request)
  if (!link) return toLogin(request, 'This sign-in link is invalid. Please request a new one.')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
  if (error) return toLogin(request, 'This sign-in link has expired or was already used. Please request a new one below.')

  // The home page sends each role to the right place
  return NextResponse.redirect(new URL('/', request.url), 303)
}
