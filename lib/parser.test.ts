import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseSlots } from './parser'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockParseResponse(slots: object[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ slots }),
  })
}

describe('parseSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty input without calling fetch', async () => {
    const result = await parseSlots('')
    expect(result).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns empty array for whitespace-only input without calling fetch', async () => {
    const result = await parseSlots('   ')
    expect(result).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('POSTs input text to /api/parse-slots', async () => {
    mockParseResponse([])
    const input = 'Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5'
    await parseSlots(input)

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith('/api/parse-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
  })

  it('returns parsed slots from API response', async () => {
    mockParseResponse([
      {
        facilitatorName: 'Gina',
        roundNumber: 1,
        dateTimeLocal: '2026-03-05T12:00:00',
        timezone: 'America/New_York',
        capacity: 5,
      },
    ])

    const result = await parseSlots('Gina:\nRound 1: March 5, 2026, 12:00 PM ET, capacity 5')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      facilitatorName: 'Gina',
      roundNumber: 1,
      dateTimeLocal: '2026-03-05T12:00:00',
      timezone: 'America/New_York',
      capacity: 5,
    })
  })

  it('returns multiple slots', async () => {
    mockParseResponse([
      { facilitatorName: 'Gina', roundNumber: 1, dateTimeLocal: '2026-03-05T12:00:00', timezone: 'America/New_York', capacity: 5 },
      { facilitatorName: 'Rasanath', roundNumber: 1, dateTimeLocal: '2026-03-05T17:00:00', timezone: 'America/New_York', capacity: 4 },
    ])

    const result = await parseSlots('some input')
    expect(result).toHaveLength(2)
    expect(result[1].facilitatorName).toBe('Rasanath')
  })

  it('returns empty array when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await parseSlots('some input')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await parseSlots('some input')
    expect(result).toHaveLength(0)
  })
})
