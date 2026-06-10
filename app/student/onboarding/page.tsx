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
    <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
      <h1 className="text-xl font-bold mb-2">Welcome!</h1>
      <p className="text-sm text-gray-600 mb-4">
        Before you get started, please confirm your timezone. This is used to show session times correctly for you.
      </p>
      <form action={confirmTimezone} onSubmit={() => setLoading(true)} className="space-y-4">
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">Your timezone</label>
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
