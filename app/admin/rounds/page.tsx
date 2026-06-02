import { createClient } from '@/lib/supabase/server'
import { updateSignupStatus } from './actions'
import Link from 'next/link'

export default async function RoundsPage() {
  const supabase = await createClient()
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*, group_sessions(id)')
    .order('round_number')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rounds</h1>
      <div className="space-y-4">
        {(rounds ?? []).map((round: any) => (
          <div key={round.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{round.title}</h2>
              <p className="text-sm text-gray-500">{round.group_sessions?.length ?? 0} groups</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${
                round.signup_status === 'open' ? 'bg-green-100 text-green-700' :
                round.signup_status === 'extra_signups_open' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {round.signup_status.replace(/_/g, ' ')}
              </span>
              <div className="flex gap-2">
                {round.signup_status !== 'open' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'open')}>
                    <button className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Open Signup</button>
                  </form>
                )}
                {round.signup_status !== 'closed' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'closed')}>
                    <button className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">Close Signup</button>
                  </form>
                )}
                {round.signup_status === 'open' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'extra_signups_open')}>
                    <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Enable Extra</button>
                  </form>
                )}
              </div>
              <Link href={`/admin/rounds/${round.id}`} className="text-sm text-blue-600 hover:underline">Manage →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
