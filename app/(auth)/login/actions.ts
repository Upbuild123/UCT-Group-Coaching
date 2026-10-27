'use server'

import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  redirect('/')
}

export async function sendMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  redirect(`/login?sent=${encodeURIComponent(email)}`)
}

// The login email also carries a one-time code ({{ .Token }} in the Supabase template). Typing it in
// works on any device and can't be used up by a company's link scanner, unlike the link.
export async function verifyLoginCode(formData: FormData) {
  const email = (formData.get('email') as string).trim()
  const token = (formData.get('code') as string).replace(/\s/g, '')
  const back = `/login?sent=${encodeURIComponent(email)}`

  if (!/^\d{6,10}$/.test(token)) {
    redirect(`${back}&error=${encodeURIComponent('Enter the code from the email (numbers only).')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })

  if (error) {
    redirect(`${back}&error=${encodeURIComponent('That code is wrong or has expired. Check the newest email, or send a new one.')}`)
  }

  redirect('/')
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const { data } = await adminClient
    .from('users')
    .select('role')
    .eq('email', email)
    .maybeSingle()
  return data?.role === 'admin'
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
