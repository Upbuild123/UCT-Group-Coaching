import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// For each student, how many sessions they're confirmed in and which round numbers they cover
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: signups, error } = await adminClient
    .from('signups')
    .select('student_id, rounds(round_number)')
    .eq('status', 'confirmed')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sessions: Record<string, { total: number; rounds: number[] }> = {}
  for (const s of signups ?? []) {
    const round = (s.rounds as unknown as { round_number: number } | null)?.round_number
    const entry = (sessions[s.student_id] ??= { total: 0, rounds: [] })
    entry.total++
    if (round && !entry.rounds.includes(round)) entry.rounds.push(round)
  }
  for (const entry of Object.values(sessions)) entry.rounds.sort()

  return NextResponse.json({ sessions })
}
