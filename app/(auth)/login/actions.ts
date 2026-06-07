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
