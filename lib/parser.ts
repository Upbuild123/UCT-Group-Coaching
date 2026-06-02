export interface ParsedSlot {
  facilitatorName: string
  roundNumber: number
  dateTimeLocal: string  // ISO wall-clock datetime e.g. "2026-03-05T12:00:00"
  timezone: string       // IANA timezone string e.g. "America/New_York"
  capacity: number
}

export async function parseSlots(input: string): Promise<ParsedSlot[]> {
  if (!input.trim()) return []

  try {
    const res = await fetch('/api/parse-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })

    if (!res.ok) return []

    const { slots } = await res.json()
    return slots as ParsedSlot[]
  } catch (err) {
    console.error('parseSlots: request failed', err)
    return []
  }
}
