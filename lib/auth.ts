import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Server actions are callable by any logged-in user, so admin actions must check the role themselves
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  return user.id
}
