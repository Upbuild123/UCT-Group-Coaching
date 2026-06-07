import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function recalculateStatus(groupId: string, newCapacity: number, confirmedCount: number) {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const newStatus = confirmedCount >= newCapacity ? 'full' : 'published'
  const { error } = await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
  if (error) throw error
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let capacity: number
  try {
    const body = await request.json() as { capacity: number }
    capacity = body.capacity
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
    return NextResponse.json({ error: 'Invalid capacity' }, { status: 400 })
  }

  // Check capacity >= confirmed count
  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmedCount = count ?? 0
  if (confirmedCount > capacity) {
    return NextResponse.json({ error: `Capacity cannot be less than current signups (${confirmedCount})` }, { status: 400 })
  }

  const { error: updateError } = await adminClient.from('group_sessions').update({ capacity }).eq('id', groupId)
  if (updateError) return NextResponse.json({ error: 'Failed to update capacity' }, { status: 500 })

  await recalculateStatus(groupId, capacity, confirmedCount)

  return NextResponse.json({ ok: true })
}
