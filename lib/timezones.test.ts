import { describe, it, expect } from 'vitest'
import { formatSessionTime } from './timezones'

// Nov 24, 2026 7:00 PM Eastern = Nov 25 00:00 UTC
const start = '2026-11-25T00:00:00Z'

describe('formatSessionTime', () => {
  it('shows the time in the chosen zone with the dropdown label', () => {
    expect(formatSessionTime(start, 'Asia/Tokyo')).toBe('Wed, Nov 25, 2026 · 9:00 AM Japan (JST)')
    expect(formatSessionTime(start, 'America/New_York')).toBe('Tue, Nov 24, 2026 · 7:00 PM Eastern (ET)')
  })

  it('falls back to the zone abbreviation for a zone not in the list', () => {
    expect(formatSessionTime(start, 'UTC')).toBe('Wed, Nov 25, 2026 · 12:00 AM UTC')
  })
})
