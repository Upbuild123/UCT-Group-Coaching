'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { parseSlots, ParsedSlot } from '@/lib/parser'

interface ConfirmSlot extends ParsedSlot {
  facilitatorId: string
  title: string
  notes: string
}

export default function NewGroupsPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string

  const [text, setText] = useState('')
  const [slots, setSlots] = useState<ConfirmSlot[]>([])
  const [facilitators, setFacilitators] = useState<Array<{ id: string; name: string }>>([])
  const [step, setStep] = useState<'paste' | 'confirm'>('paste')
  const [submitting, setSubmitting] = useState(false)

  async function handleParse() {
    const parsed = await parseSlots(text)
    const res = await fetch('/api/users?role=facilitator')
    const { users } = await res.json()
    setFacilitators(users)

    const confirmed: ConfirmSlot[] = parsed.map(slot => {
      const matched = users.find((u: any) =>
        u.name.toLowerCase().startsWith(slot.facilitatorName.toLowerCase())
      )
      return {
        ...slot,
        facilitatorId: matched?.id ?? '',
        title: `Group Coaching Round ${slot.roundNumber} ${slot.facilitatorName}`,
        notes: '',
      }
    })
    setSlots(confirmed)
    setStep('confirm')
  }

  function updateSlot(index: number, field: keyof ConfirmSlot, value: string | number) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleConfirm() {
    setSubmitting(true)
    const payload = slots.map(slot => ({
      roundId,
      facilitatorId: slot.facilitatorId,
      title: slot.title,
      notes: slot.notes,
      dateTimeLocal: slot.dateTimeLocal,
      timezone: slot.timezone,
      capacity: slot.capacity,
    }))

    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: payload }),
    })

    router.push(`/admin/rounds/${roundId}`)
  }

  if (step === 'paste') {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Add Groups</h1>
        <div className="card">
          <label className="block text-sm font-medium text-slate-700 mb-2">Paste schedule text</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            placeholder={`Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5`}
            className="input font-mono"
          />
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="btn-primary mt-3"
          >
            Parse
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Confirm Groups ({slots.length})</h1>
      <div className="space-y-4 mb-6">
        {slots.map((slot, i) => (
          <div key={i} className="card">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Facilitator</label>
                <select
                  value={slot.facilitatorId}
                  onChange={e => updateSlot(i, 'facilitatorId', e.target.value)}
                  className="input py-1"
                >
                  <option value="">-- select --</option>
                  {facilitators.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Round</label>
                <select
                  value={slot.roundNumber}
                  onChange={e => updateSlot(i, 'roundNumber', parseInt(e.target.value))}
                  className="input py-1"
                >
                  {[1,2,3,4].map(n => <option key={n} value={n}>Round {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Capacity</label>
                <input
                  type="number" min={1} max={20}
                  value={slot.capacity}
                  onChange={e => updateSlot(i, 'capacity', parseInt(e.target.value))}
                  className="input py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date & Time (local)</label>
                <input
                  type="datetime-local"
                  value={slot.dateTimeLocal}
                  onChange={e => updateSlot(i, 'dateTimeLocal', e.target.value)}
                  className="input py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Title</label>
                <input
                  value={slot.title}
                  onChange={e => updateSlot(i, 'title', e.target.value)}
                  className="input py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <input
                  value={slot.notes}
                  onChange={e => updateSlot(i, 'notes', e.target.value)}
                  className="input py-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('paste')} className="btn-secondary">
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting || slots.some(s => !s.facilitatorId)}
          className="btn-primary"
        >
          {submitting ? 'Creating...' : 'Confirm & Create Groups'}
        </button>
      </div>
    </div>
  )
}
