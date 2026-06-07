import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cancelGroup } from './actions'
import GroupsTable from './GroupsTable'

export default async function RoundDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (!round) notFound()

  const { data: groups } = await supabase
    .from('group_sessions')
    .select('*, users!facilitator_id(name), signups(id, status)')
    .eq('round_id', roundId)
    .order('start_time_utc')

  const { data: allStudents } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('role', 'student')
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{round.title} — Groups</h1>
        <Link href={`/admin/rounds/${roundId}/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Add Groups
        </Link>
      </div>
      <GroupsTable
        groups={(groups ?? []).filter((g: any) => g.status !== 'canceled')}
        roundId={roundId}
        allStudents={allStudents ?? []}
        cancelGroup={cancelGroup}
      />
    </div>
  )
}
