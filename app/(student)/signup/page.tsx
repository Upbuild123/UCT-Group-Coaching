'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'

interface Group {
  id: string
  title: string
  facilitator_name: string
  start_time_utc: string
  original_timezone: string
  capacity: number
  status: string
  confirmed_count: number
  my_signup_id: string | null
}

interface RoundData {
  id: string
  round_number: number
  title: string
  signup_status: string
  groups: Group[]
}

export default function SignupPage() {
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [activeRound, setActiveRound] = useState(0)
  const [myTimezone, setMyTimezone] = useState('America/New_York')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('timezone').eq('id', user!.id).single()
    setMyTimezone(profile?.timezone ?? 'America/New_York')

    const { data: roundsData } = await supabase
      .from('rounds')
      .select(`id, round_number, title, signup_status, group_sessions(id, title, start_time_utc, original_timezone, capacity, status, users!facilitator_id(name), signups(id, status, student_id))`)
      .order('round_number')

    const userId = user!.id
    const mapped = (roundsData ?? []).map((r: any) => ({
      ...r,
      groups: (r.group_sessions ?? [])
        .filter((g: any) => ['published', 'full'].includes(g.status))
        .map((g: any) => ({
          id: g.id,
          title: g.title,
          facilitator_name: g.users?.name ?? '',
          start_time_utc: g.start_time_utc,
          original_timezone: g.original_timezone,
          capacity: g.capacity,
          status: g.status,
          confirmed_count: (g.signups ?? []).filter((s: any) => s.status === 'confirmed').length,
          my_signup_id: (g.signups ?? []).find((s: any) => s.student_id === userId && s.status === 'confirmed')?.id ?? null,
        })),
    }))

    setRounds(mapped)
    setLoading(false)
  }

  async function handleSignup(groupId: string) {
    setActionLoading(groupId)
    await fetch('/api/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupSessionId: groupId }),
    })
    await loadData()
    setActionLoading(null)
  }

  async function handleCancel(signupId: string) {
    setActionLoading(signupId)
    await fetch(`/api/signups/${signupId}`, { method: 'DELETE' })
    await loadData()
    setActionLoading(null)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const round = rounds[activeRound]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Group Coaching Signup</h1>
      <div className="flex gap-2 mb-6">
        {rounds.map((r, i) => (
          <button key={r.id} onClick={() => setActiveRound(i)}
            className={`px-4 py-2 rounded text-sm font-medium ${i === activeRound ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {r.title}
          </button>
        ))}
      </div>

      {round && (
        <div>
          {round.signup_status === 'closed' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-700">
              Signup is currently closed for {round.title}.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {round.groups.map(group => {
              const isSignedUp = !!group.my_signup_id
              const isFull = group.status === 'full' && !isSignedUp
              const seatsLeft = group.capacity - group.confirmed_count

              return (
                <div key={group.id} className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium mb-1">{group.facilitator_name}</h3>
                  <p className="text-sm text-gray-500 mb-1">
                    {formatInTimeZone(new Date(group.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
                  </p>
                  {myTimezone !== group.original_timezone && (
                    <p className="text-xs text-gray-400 mb-2">
                      {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, h:mm a zzz')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mb-3">
                    {isFull ? 'Full' : `${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} left`}
                  </p>

                  {isSignedUp ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Signed up</span>
                      <button onClick={() => handleCancel(group.my_signup_id!)}
                        disabled={actionLoading === group.my_signup_id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  ) : isFull ? (
                    <button disabled className="text-xs px-3 py-1 border rounded text-gray-400 cursor-not-allowed">Full</button>
                  ) : round.signup_status === 'closed' ? (
                    <button disabled className="text-xs px-3 py-1 border rounded text-gray-400 cursor-not-allowed">Closed</button>
                  ) : (
                    <button onClick={() => handleSignup(group.id)}
                      disabled={actionLoading === group.id}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {actionLoading === group.id ? 'Signing up...' : 'Sign up'}
                    </button>
                  )}
                </div>
              )
            })}
            {round.groups.length === 0 && (
              <p className="text-gray-400 text-sm col-span-3">No groups available for this round yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
