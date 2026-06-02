'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SignupStatus } from '@/lib/types'

export async function updateSignupStatus(roundId: string, status: SignupStatus) {
  const supabase = await createClient()
  await supabase.from('rounds').update({ signup_status: status }).eq('id', roundId)
  revalidatePath('/admin/rounds')
}
