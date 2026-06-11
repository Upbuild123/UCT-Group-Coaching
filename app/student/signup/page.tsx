'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'
import { TIMEZONES } from '@/lib/timezones'

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

  useEffect(() => {
    setModalGroupId(null)
    setModalReason('')
    setRequestError(null)
  }, [activeRound])

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

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  const round = rounds[activeRound]
  const modalGroup = modalGroupId ? round?.groups.find(g => g.id === modalGroupId) ?? null : null

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Group Coaching Signup</h1>
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
      <div className="flex gap-2 mb-6">
        {rounds.map((r, i) => (
          <button key={r.id} onClick={() => setActiveRound(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${i === activeRound ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {r.title}
          </button>
        ))}
      </div>

      {round && (
        <div>
          {round.signup_status === 'closed' && (
            <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
              Signup is currently closed for {round.title}.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {round.groups.map(group => {
              const isSignedUp = !!group.my_signup_id
              const isFull = group.status === 'full' && !isSignedUp

              return (
                <div key={group.id} className="card flex flex-col">
                  <h3 className="font-semibold text-slate-900 mb-1">{group.facilitator_name}</h3>
                  <p className="text-sm text-slate-600 mb-1">
                    {formatInTimeZone(new Date(group.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
                  </p>
                  {myTimezone !== group.original_timezone && (
                    <p className="text-xs text-slate-400 mb-2">
                      {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, h:mm a zzz')}
                    </p>
                  )}
                  {isFull && (
                    <span className="badge-gray w-fit mb-3">Full</span>
                  )}

                  <div className="mt-auto pt-2">
                    {isSignedUp ? (
                      <div className="flex gap-3 items-center">
                        <span className="badge-green">Signed up</span>
                        <button onClick={() => handleCancel(group.my_signup_id!)}
                          disabled={actionLoading === group.my_signup_id}
                          className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : isFull ? (
                      pendingRequests.has(group.id) ? (
                        <button disabled className="btn-secondary text-xs px-3 py-1.5 cursor-not-allowed">Request pending</button>
                      ) : (
                        <button
                          onClick={() => { setModalGroupId(group.id); setModalReason(''); setRequestError(null) }}
                          className="btn-secondary text-xs px-3 py-1.5 text-brand-700 ring-brand-200 hover:bg-brand-50">
                          Request to join
                        </button>
                      )
                    ) : round.signup_status === 'closed' ? (
                      <button disabled className="btn-secondary text-xs px-3 py-1.5 cursor-not-allowed">Closed</button>
                    ) : (
                      <button onClick={() => handleSignup(group.id)}
                        disabled={actionLoading === group.id}
                        className="btn-primary text-xs px-3 py-1.5">
                        {actionLoading === group.id ? 'Signing up...' : 'Sign up'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {round.groups.length === 0 && (
              <p className="text-slate-400 text-sm col-span-3">No groups available for this round yet.</p>
            )}
          </div>
        </div>
      )}

      {modalGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="font-semibold text-lg mb-1 text-slate-900">Request to join full group</h2>
            <p className="text-sm text-slate-600 mb-4">
              {modalGroup.facilitator_name} —{' '}
              {formatInTimeZone(new Date(modalGroup.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
            </p>
            <label className="block text-sm text-slate-600 mb-1">Reason (optional)</label>
            <textarea
              value={modalReason}
              onChange={e => setModalReason(e.target.value)}
              placeholder="Why do you want to join this group?"
              rows={3}
              className="input mb-3 resize-none"
            />
            {requestError && (
              <p className="text-sm text-rose-600 mb-3">{requestError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalGroupId(null)}
                className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleRequest(modalGroupId!)}
                disabled={requestLoading}
                className="btn-primary">
                {requestLoading ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
