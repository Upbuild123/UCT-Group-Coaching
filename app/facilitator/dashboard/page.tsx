import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'

export default async function FacilitatorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: groups } = await supabase
    .from('group_sessions')
    .select(`id, title, start_time_utc, original_timezone, capacity, status, rounds(title), signups(id, status, users!student_id(name, email))`)
    .eq('facilitator_id', user!.id)
    .neq('status', 'canceled')
    .order('start_time_utc')

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">My Groups</h1>
      {(groups ?? []).length === 0 ? (
        <p className="text-slate-400">No groups assigned yet.</p>
      ) : (
        <div className="space-y-4">
          {(groups ?? []).map((group: any) => {
            const confirmed = (group.signups ?? []).filter((s: any) => s.status === 'confirmed')
            const openSeats = Math.max(0, group.capacity - confirmed.length)
            return (
              <div key={group.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{group.rounds?.title}</p>
                    <h2 className="font-semibold text-slate-900">{group.title.replace(/^Group Coaching Round \d+\s*/i, '')}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={group.status === 'full' ? 'badge-brand' : 'badge-green'}>
                      {confirmed.length} / {group.capacity}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{openSeats} open seat{openSeats !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {confirmed.length > 0 ? (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Roster</p>
                    <ul className="space-y-1">
                      {confirmed.map((s: any) => (
                        <li key={s.id} className="text-sm text-slate-700">
                          {s.users?.name} <span className="text-slate-400">— {s.users?.email}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 pt-3 border-t border-slate-100">No students signed up yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
