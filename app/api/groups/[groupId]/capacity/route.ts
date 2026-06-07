import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function recalculateStatus(groupId: string, newCapacity: number) {
  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const newStatus = confirmed >= newCapacity ? 'full' : 'published'
  await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
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

  const { capacity } = await request.json() as { capacity: number }

  if (typeof capacity !== 'number' || capacity < 1) {
    return NextResponse.json({ error: 'Invalid capacity' }, { status: 400 })
  }

  // Check capacity >= confirmed count
  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  if ((count ?? 0) > capacity) {
    return NextResponse.json({ error: `Capacity cannot be less than current signups (${count})` }, { status: 400 })
  }

  await adminClient.from('group_sessions').update({ capacity }).eq('id', groupId)
  await recalculateStatus(groupId, capacity)

  return NextResponse.json({ ok: true })
}
