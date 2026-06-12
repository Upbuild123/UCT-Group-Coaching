'use client'

import { useState } from 'react'
import { TIMEZONES } from '@/lib/timezones'

interface Facilitator {
  id: string
  name: string
}

export default function ManualAddGroup({ facilitators }: { facilitators: Facilitator[] }) {
  const [open, setOpen] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const [facilitatorId, setFacilitatorId] = useState('')
  const [title, setTitle] = useState('')
  const [dateTimeLocal, setDateTimeLocal] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [capacity, setCapacity] = useState(6)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function facilitatorFirstName(id: string): string {
    const f = facilitators.find(f => f.id === id)
    return f ? f.name.split(' ')[0] : ''
  }

  function handleFacilitatorChange(id: string) {
    setFacilitatorId(id)
    if (!title.trim() || /^Group Coaching Round \d+/.test(title)) {
      setTitle(`Group Coaching Round ${roundNumber} ${facilitatorFirstName(id)}`)
    }
  }

  function handleRoundChange(n: number) {
    setRoundNumber(n)
    if (!title.trim() || /^Group Coaching Round \d+/.test(title)) {
      setTitle(`Group Coaching Round ${n} ${facilitatorFirstName(facilitatorId)}`)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [{
          roundNumber,
          facilitatorId,
          title,
          notes,
          dateTimeLocal,
          timezone,
          capacity,
        }],
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok || !data.created?.length) {
      setError('Failed to create group')
      return
    }
    setOpen(false)
    setFacilitatorId('')
    setTitle('')
    setDateTimeLocal('')
    setNotes('')
    window.location.reload()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary mb-6 text-sm">
        + Add Single Group
      </button>
    )
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">Add Single Group</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
      </div>

      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Round</label>
          <select value={roundNumber} onChange={e => handleRoundChange(parseInt(e.target.value))} className="input py-1">
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>Round {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Facilitator</label>
          <select value={facilitatorId} onChange={e => handleFacilitatorChange(e.target.value)} className="input py-1">
            <option value="">-- select --</option>
            {facilitators.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Capacity</label>
          <input type="number" min={1} max={20} value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value))} className="input py-1" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date & time (local)</label>
          <input type="datetime-local" value={dateTimeLocal}
            onChange={e => setDateTimeLocal(e.target.value)} className="input py-1" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input py-1">
            {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input py-1" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs text-slate-500 mb-1">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input py-1" />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !facilitatorId || !dateTimeLocal || !title.trim()}
        className="btn-primary text-sm"
      >
        {submitting ? 'Creating...' : 'Create Group'}
      </button>
    </div>
  )
}
