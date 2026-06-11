'use client'

import { useState } from 'react'
import { confirmTimezone } from './actions'
import { TIMEZONES } from '@/lib/timezones'

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TIMEZONES.some(t => t.value === tz) ? tz : 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export default function OnboardingPage() {
  const [timezone, setTimezone] = useState(detectTimezone)
  const [loading, setLoading] = useState(false)

  return (
    <div className="max-w-md mx-auto card p-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-2">Welcome!</h1>
      <p className="text-sm text-slate-600 mb-4">
        Before you get started, please confirm your timezone. This is used to show session times correctly for you.
      </p>
      <form action={confirmTimezone} onSubmit={() => setLoading(true)} className="space-y-4">
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-slate-700">Your timezone</label>
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="input mt-1"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
