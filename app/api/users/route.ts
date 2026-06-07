import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  let query = supabase.from('users').select('id, name, email, role').order('name')
  if (role === 'facilitator') query = query.in('role', ['facilitator', 'admin'])
  else if (role) query = query.eq('role', role)

  const { data: users } = await query
  return NextResponse.json({ users: users ?? [] })
}
