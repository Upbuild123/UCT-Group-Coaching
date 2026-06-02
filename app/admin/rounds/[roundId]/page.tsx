import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { cancelGroup } from './actions'

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{round.title} — Groups</h1>
        <Link href={`/admin/rounds/${roundId}/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Add Groups
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Facilitator</th>
              <th className="text-left p-4 font-medium text-gray-600">Date / Time</th>
              <th className="text-left p-4 font-medium text-gray-600">Capacity</th>
              <th className="text-left p-4 font-medium text-gray-600">Signups</th>
              <th className="text-left p-4 font-medium text-gray-600">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {(groups ?? []).map((group: any) => {
              const confirmed = (group.signups ?? []).filter((s: any) => s.status === 'confirmed').length
              return (
                <tr key={group.id} className="border-b last:border-0">
                  <td className="p-4">{group.users?.name}</td>
                  <td className="p-4">
                    {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                  </td>
                  <td className="p-4">{group.capacity}</td>
                  <td className="p-4">{confirmed} / {group.capacity}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      group.status === 'published' ? 'bg-green-100 text-green-700' :
                      group.status === 'full' ? 'bg-orange-100 text-orange-700' :
                      group.status === 'canceled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {group.status !== 'canceled' && (
                      <form action={cancelGroup.bind(null, group.id)}>
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {(groups ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-4 text-gray-400 text-center">No groups yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
