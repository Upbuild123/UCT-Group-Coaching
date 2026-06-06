'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONES = [
  { label: 'Eastern (ET)', value: 'America/New_York' },
  { label: 'Central (CT)', value: 'America/Chicago' },
  { label: 'Mountain (MT)', value: 'America/Denver' },
  { label: 'Pacific (PT)', value: 'America/Los_Angeles' },
  { label: 'Alaska (AKT)', value: 'America/Anchorage' },
  { label: 'Hawaii (HT)', value: 'Pacific/Honolulu' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris / Berlin (CET)', value: 'Europe/Paris' },
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'Japan (JST)', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney (AEST)', value: 'Australia/Sydney' },
]

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
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set())
  const [modalGroupId, setModalGroupId] = useState<string | null>(null)
  const [modalReason, setModalReason] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function handleTimezoneChange(tz: string) {
    setMyTimezone(tz)
    if (!userId) return
    const supabase = createClient()
    await supabase.from('users').update({ timezone: tz }).eq('id', userId)
  }

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
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

    // Load pending full group requests for this student
    const { data: pendingReqs } = await supabase
      .from('full_group_requests')
      .select('requested_group_session_id')
      .eq('student_id', user!.id)
      .eq('status', 'pending')

    setPendingRequests(new Set((pendingReqs ?? []).map((r: any) => r.requested_group_session_id)))

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

  async function handleRequest(groupId: string) {
    setRequestLoading(true)
    setRequestError(null)
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupSessionId: groupId, reason: modalReason || undefined }),
    })
    if (res.ok) {
      setPendingRequests(prev => new Set([...prev, groupId]))
      setModalGroupId(null)
      setModalReason('')
    } else {
      const data = await res.json()
      setRequestError(data.error ?? 'Something went wrong')
    }
    setRequestLoading(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const round = rounds[activeRound]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Group Coaching Signup</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Your timezone:</label>
          <select
            value={myTimezone}
            onChange={e => handleTimezoneChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-700"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>
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
                    pendingRequests.has(group.id) ? (
                      <button disabled className="text-xs px-3 py-1 border rounded text-gray-400 cursor-not-allowed">Request pending</button>
                    ) : (
                      <button
                        onClick={() => { setModalGroupId(group.id); setModalReason(''); setRequestError(null) }}
                        className="text-xs px-3 py-1 border border-blue-500 text-blue-600 rounded hover:bg-blue-50">
                        Request to join
                      </button>
                    )
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

      {modalGroupId && (() => {
        const modalGroup = round?.groups.find(g => g.id === modalGroupId)
        if (!modalGroup) return null
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h2 className="font-semibold text-lg mb-1">Request to join full group</h2>
              <p className="text-sm text-gray-600 mb-4">
                {modalGroup.facilitator_name} —{' '}
                {formatInTimeZone(new Date(modalGroup.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
              </p>
              <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
              <textarea
                value={modalReason}
                onChange={e => setModalReason(e.target.value)}
                placeholder="Why do you want to join this group?"
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm mb-3 resize-none"
              />
              {requestError && (
                <p className="text-sm text-red-600 mb-3">{requestError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalGroupId(null)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleRequest(modalGroupId)}
                  disabled={requestLoading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {requestLoading ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
