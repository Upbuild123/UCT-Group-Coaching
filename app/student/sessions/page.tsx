'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'
import { TIMEZONES } from '@/lib/timezones'

interface SessionItem {
  id: string
  status: string
  facilitator_name: string
  round_title: string
  start_time_utc: string
  original_timezone: string
}

export default function MySessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [myTimezone, setMyTimezone] = useState('America/New_York')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)

    const { data: profile } = await supabase.from('users').select('timezone').eq('id', user!.id).single()
    setMyTimezone(profile?.timezone ?? 'America/New_York')

    const { data: signups } = await supabase
      .from('signups')
      .select(`id, status, signup_type, group_sessions(id, title, start_time_utc, original_timezone, status, users!facilitator_id(name), rounds(title))`)
      .eq('student_id', user!.id)
      .eq('status', 'confirmed')
      .order('created_at')

    const mapped = (signups ?? [])
      .filter((signup: any) => signup.group_sessions)
      .map((signup: any) => {
        const group = signup.group_sessions
        return {
          id: signup.id,
          status: group.status,
          facilitator_name: (group.users?.name ?? '').split(' ')[0],
          round_title: group.rounds?.title ?? '',
          start_time_utc: group.start_time_utc,
          original_timezone: group.original_timezone,
        }
      })
      .sort((a: any, b: any) => a.start_time_utc.localeCompare(b.start_time_utc))

    setSessions(mapped)
    setLoading(false)
  }

  async function handleTimezoneChange(tz: string) {
    setMyTimezone(tz)
    if (!userId) return
    const supabase = createClient()
    await supabase.from('users').update({ timezone: tz }).eq('id', userId)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Sessions</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Your timezone:</label>
          <select
            value={myTimezone}
            onChange={e => handleTimezoneChange(e.target.value)}
            className="input py-1.5"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>
      {sessions.length === 0 ? (
        <p className="text-slate-400">You haven't signed up for any sessions yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map(session => (
            <div key={session.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-1">{session.round_title}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Facilitator</p>
                  <h3 className="font-semibold text-slate-900 mb-1">{session.facilitator_name}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {formatInTimeZone(new Date(session.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
                  </p>
                  {myTimezone !== session.original_timezone && (
                    <p className="text-xs text-slate-400">
                      {formatInTimeZone(new Date(session.start_time_utc), session.original_timezone, 'MMM d, h:mm a zzz')}
                    </p>
                  )}
                </div>
                {session.status === 'canceled' && (
                  <span className="badge-red">canceled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
