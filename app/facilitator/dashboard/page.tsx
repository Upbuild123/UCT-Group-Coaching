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
      <h1 className="text-2xl font-bold mb-6">My Groups</h1>
      {(groups ?? []).length === 0 ? (
        <p className="text-gray-400">No groups assigned yet.</p>
      ) : (
        <div className="space-y-6">
          {(groups ?? []).map((group: any) => {
            const confirmed = (group.signups ?? []).filter((s: any) => s.status === 'confirmed')
            return (
              <div key={group.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400">{group.rounds?.title}</p>
                    <h2 className="font-semibold">{group.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${group.status === 'full' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {confirmed.length} / {group.capacity}
                  </span>
                </div>
                {confirmed.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Roster</p>
                    <ul className="space-y-1">
                      {confirmed.map((s: any) => (
                        <li key={s.id} className="text-sm text-gray-700">
                          {s.users?.name} <span className="text-gray-400">— {s.users?.email}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No students signed up yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
