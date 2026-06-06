import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { processDecision } from '@/lib/requests'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const decisionValue = formData.get('decision')
  const keepCurrentSlot = formData.get('keepCurrentSlot') === 'true'

  if (!decisionValue || (decisionValue !== 'approved' && decisionValue !== 'rejected')) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }
  const decision = decisionValue as 'approved' | 'rejected'

  try {
    await processDecision({
      requestId: id,
      decision,
      actorUserId: user.id,
      keepCurrentSlot,
      facilitatorField: null,
    })
  } catch (err) {
    console.error('Admin processDecision failed:', err)
    return NextResponse.json({ error: 'Failed to process decision' }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
}
