'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function confirmTimezone(formData: FormData) {
  const timezone = formData.get('timezone') as string
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('users')
    .update({ timezone, timezone_confirmed: true })
    .eq('id', user.id)

  redirect('/student/signup')
}
