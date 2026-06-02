import { describe, it, expect } from 'vitest'
import { parseSlots } from './parser'

describe('parseSlots', () => {
  it('parses a single facilitator with one slot', () => {
    const input = `Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5`
    const result = parseSlots(input)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      facilitatorName: 'Gina',
      roundNumber: 1,
      dateTimeLocal: '2026-03-05T12:00:00',
      timezone: 'America/New_York',
      capacity: 5,
    })
  })

  it('parses multiple facilitators with multiple slots', () => {
    const input = `Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5\nRound 2: April 10, 2026, 1:00 PM ET, capacity 6\n\nRasanath:\nRound 1: March 5, 2026, 5:00 PM ET, capacity 4`
    const result = parseSlots(input)
    expect(result).toHaveLength(3)
    expect(result[0].facilitatorName).toBe('Gina')
    expect(result[0].roundNumber).toBe(1)
    expect(result[1].facilitatorName).toBe('Gina')
    expect(result[1].roundNumber).toBe(2)
    expect(result[2].facilitatorName).toBe('Rasanath')
    expect(result[2].capacity).toBe(4)
  })

  it('maps ET to America/New_York', () => {
    const result = parseSlots(`Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5`)
    expect(result[0].timezone).toBe('America/New_York')
  })

  it('maps CT to America/Chicago', () => {
    const result = parseSlots(`Gina:\nRound 1: March 5, 2026, 12:00 PM CT, capacity 5`)
    expect(result[0].timezone).toBe('America/Chicago')
  })

  it('maps PT to America/Los_Angeles', () => {
    const result = parseSlots(`Gina:\nRound 1: March 5, 2026, 12:00 PM PT, capacity 5`)
    expect(result[0].timezone).toBe('America/Los_Angeles')
  })

  it('handles PM times correctly', () => {
    const result = parseSlots(`Gina:\nRound 1: March 5, 2026, 3:00 PM ET, capacity 5`)
    expect(result[0].dateTimeLocal).toBe('2026-03-05T15:00:00')
  })

  it('returns empty array for empty input', () => {
    expect(parseSlots('')).toHaveLength(0)
    expect(parseSlots('   ')).toHaveLength(0)
  })

  it('skips malformed slot lines without throwing', () => {
    const result = parseSlots(`Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5\nthis is not a valid line`)
    expect(result).toHaveLength(1)
  })
})
