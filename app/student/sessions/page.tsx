import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'

export default async function MySessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('users').select('timezone').eq('id', user!.id).single()
  const tz = profile?.timezone ?? 'America/New_York'

  const { data: signups } = await supabase
    .from('signups')
    .select(`id, status, signup_type, group_sessions(id, title, start_time_utc, original_timezone, status, users!facilitator_id(name), rounds(title))`)
    .eq('student_id', user!.id)
    .eq('status', 'confirmed')
    .order('created_at')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Sessions</h1>
      {(signups ?? []).length === 0 ? (
        <p className="text-gray-400">You haven't signed up for any sessions yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(signups ?? []).map((signup: any) => {
            const group = signup.group_sessions
            return (
              <div key={signup.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{group.rounds?.title}</p>
                    <h3 className="font-medium">{group.users?.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatInTimeZone(new Date(group.start_time_utc), tz, 'MMM d, yyyy h:mm a zzz')}
                    </p>
                    {tz !== group.original_timezone && (
                      <p className="text-xs text-gray-400">
                        {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, h:mm a zzz')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${group.status === 'canceled' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {group.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
