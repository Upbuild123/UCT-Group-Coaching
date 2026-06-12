'use client'

import { useState } from 'react'
import { parseSlots, ParsedSlot } from '@/lib/parser'
import { formatInTimeZone } from 'date-fns-tz'
import { fromZonedTime } from 'date-fns-tz'

interface ConfirmSlot extends ParsedSlot {
  facilitatorId: string
  title: string
  notes: string
}

interface Facilitator {
  id: string
  name: string
}

export default function GroupParser({ facilitators }: { facilitators: Facilitator[] }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [slots, setSlots] = useState<ConfirmSlot[]>([])
  const [step, setStep] = useState<'paste' | 'confirm'>('paste')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [parseError, setParseError] = useState('')

  function matchFacilitator(name: string): string {
    const lower = name.toLowerCase()
    return facilitators.find(f => f.name.toLowerCase().startsWith(lower))?.id ?? ''
  }

  async function handleParse(inputText = text) {
    const combined = adjustment.trim()
      ? `${inputText}\n\n${adjustment}`
      : inputText
    setParsing(true)
    setParseError('')
    const parsed = await parseSlots(combined)
    setParsing(false)
    if (parsed.length === 0) {
      setParseError('No slots found. Check your format and try again.')
      return
    }
    setSlots(parsed.map(slot => ({
      ...slot,
      facilitatorId: matchFacilitator(slot.facilitatorName),
      title: `Group Coaching Round ${slot.roundNumber} ${slot.facilitatorName}`,
      notes: '',
    })))
    setAdjustment('')
    setStep('confirm')
  }

  async function handleAdjust() {
    if (!adjustment.trim()) return
    const combined = `${text}\n\n${adjustment}`
    setParsing(true)
    setParseError('')
    const parsed = await parseSlots(combined)
    setParsing(false)
    if (parsed.length === 0) {
      setParseError('Adjustment returned no slots.')
      return
    }
    setSlots(parsed.map(slot => ({
      ...slot,
      facilitatorId: matchFacilitator(slot.facilitatorName),
      title: `Group Coaching Round ${slot.roundNumber} ${slot.facilitatorName}`,
      notes: '',
    })))
    setAdjustment('')
  }

  function updateSlot(i: number, field: keyof ConfirmSlot, value: string | number) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function handleConfirm() {
    setSubmitting(true)
    const payload = slots.map(slot => ({
      roundNumber: slot.roundNumber,
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
    setSubmitting(false)
    setText('')
    setSlots([])
    setStep('paste')
    setOpen(false)
    window.location.reload()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mb-6 text-sm">
        + Add Groups
      </button>
    )
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">Add Groups</h2>
        <button onClick={() => { setOpen(false); setStep('paste') }}
          className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
      </div>

      {step === 'paste' && (
        <>
          <p className="text-xs text-slate-400 mb-3">
            Paste names and dates — round numbers are assigned by order. Include instructions like "change all to capacity 5" anywhere in the text.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            placeholder={`Gina Nov 12. 5:30 pm ET\nDec 3. 12 pm ET\nDec 11 2 pm ET\nJan 7 5:30 ET\n\nVipin Nov 14 10am ET\nDec 5 2pm ET\n...`}
            className="input font-mono mb-3"
          />
          {parseError && <p className="text-rose-600 text-sm mb-2">{parseError}</p>}
          <button onClick={() => handleParse()} disabled={!text.trim() || parsing} className="btn-primary text-sm">
            {parsing ? 'Parsing...' : 'Parse'}
          </button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="border border-slate-200 rounded-lg mb-4 overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Round</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Facilitator</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Date & Time</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500 w-16">Cap.</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Title</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-1.5">
                      <select value={slot.roundNumber} onChange={e => updateSlot(i, 'roundNumber', parseInt(e.target.value))}
                        className="input py-1 w-24">
                        {[1,2,3,4].map(n => <option key={n} value={n}>Round {n}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={slot.facilitatorId} onChange={e => updateSlot(i, 'facilitatorId', e.target.value)}
                        className="input py-1">
                        <option value="">-- select --</option>
                        {facilitators.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <input type="datetime-local" value={slot.dateTimeLocal}
                        onChange={e => updateSlot(i, 'dateTimeLocal', e.target.value)}
                        className="input py-1" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" min={1} max={20} value={slot.capacity}
                        onChange={e => updateSlot(i, 'capacity', parseInt(e.target.value))}
                        className="input py-1 w-16" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input value={slot.title} onChange={e => updateSlot(i, 'title', e.target.value)}
                        className="input py-1 w-64" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={adjustment}
              onChange={e => setAdjustment(e.target.value)}
              placeholder='e.g. "change all groups to capacity 5" or "set Gina to capacity 4"'
              className="input flex-1"
            />
            <button onClick={handleAdjust} disabled={!adjustment.trim() || parsing} className="btn-secondary text-sm whitespace-nowrap">
              {parsing ? 'Applying...' : 'Apply'}
            </button>
          </div>
          {parseError && <p className="text-rose-600 text-sm mb-2">{parseError}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep('paste')} className="btn-secondary text-sm">Back</button>
            <button onClick={handleConfirm}
              disabled={submitting || slots.some(s => !s.facilitatorId)}
              className="btn-primary text-sm">
              {submitting ? 'Creating...' : `Create ${slots.length} group${slots.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
