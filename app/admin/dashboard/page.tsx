import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*, group_sessions(id, status, capacity, signups(id, status))')
    .order('round_number')

  const stats = (rounds ?? []).map((round: any) => {
    const groups = round.group_sessions ?? []
    const totalSignups = groups.flatMap((g: any) => g.signups ?? [])
      .filter((s: any) => s.status === 'confirmed').length
    const openSeats = groups
      .filter((g: any) => g.status === 'published')
      .reduce((acc: number, g: any) => {
        const confirmed = (g.signups ?? []).filter((s: any) => s.status === 'confirmed').length
        return acc + Math.max(0, g.capacity - confirmed)
      }, 0)
    return {
      round,
      groupCount: groups.length,
      totalSignups,
      openSeats,
      fullGroups: groups.filter((g: any) => g.status === 'full').length,
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ round, groupCount, totalSignups, openSeats, fullGroups }) => (
          <div key={round.id} className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-lg mb-3">{round.title}</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Groups</dt><dd>{groupCount}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Signups</dt><dd>{totalSignups}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Open seats</dt><dd>{openSeats}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Full groups</dt><dd>{fullGroups}</dd></div>
            </dl>
            <div className="mt-3">
              <span className={`text-xs px-2 py-1 rounded-full ${
                round.signup_status === 'open' ? 'bg-green-100 text-green-700' :
                round.signup_status === 'extra_signups_open' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {round.signup_status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
