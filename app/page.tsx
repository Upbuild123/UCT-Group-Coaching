import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, timezone_confirmed')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin/dashboard')
  if (profile?.role === 'facilitator') redirect('/facilitator/dashboard')
  if (!profile?.timezone_confirmed) redirect('/student/onboarding')
  redirect('/student/signup')
}
