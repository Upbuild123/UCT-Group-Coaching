import { createClient } from '@/lib/supabase/server'
import { updateSignupStatus } from './actions'
import Link from 'next/link'
import GroupParser from './GroupParser'

export default async function RoundsPage() {
  const supabase = await createClient()
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*, group_sessions(id, status)')
    .order('round_number')

  const { data: facilitators } = await supabase
    .from('users')
    .select('id, name')
    .in('role', ['facilitator', 'admin'])
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Rounds</h1>
      <GroupParser facilitators={facilitators ?? []} />
      <div className="space-y-3">
        {(rounds ?? []).map((round: any) => (
          <div key={round.id} className="card flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{round.title}</h2>
              <p className="text-sm text-slate-500">{(round.group_sessions ?? []).filter((g: any) => g.status === 'published' || g.status === 'full').length} groups</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={
                round.signup_status === 'open' ? 'badge-green' :
                round.signup_status === 'extra_signups_open' ? 'badge-brand' :
                'badge-gray'
              }>
                {round.signup_status.replace(/_/g, ' ')}
              </span>
              <div className="flex gap-2">
                {round.signup_status !== 'open' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'open')}>
                    <button className="btn-secondary text-xs px-3 py-1.5">Open Signup</button>
                  </form>
                )}
                {round.signup_status !== 'closed' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'closed')}>
                    <button className="btn-secondary text-xs px-3 py-1.5">Close Signup</button>
                  </form>
                )}
                {round.signup_status === 'open' && (
                  <form action={updateSignupStatus.bind(null, round.id, 'extra_signups_open')}>
                    <button className="btn-primary text-xs px-3 py-1.5">Enable Extra</button>
                  </form>
                )}
              </div>
              <Link href={`/admin/rounds/${round.id}`} className="text-sm font-medium text-brand-600 hover:underline">Manage →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
