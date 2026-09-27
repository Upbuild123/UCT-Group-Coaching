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

    if (!res.ok) {
      console.error('parseSlots: non-ok response', res.status)
      return []
    }

    const { slots } = await res.json()
    return slots as ParsedSlot[]
  } catch (err) {
    console.error('parseSlots: request failed', err)
    return []
  }
}

// Keep an auto-generated "Group Coaching Round N ..." title in step with the chosen round
export function retitleForRound(title: string, roundNumber: number): string {
  return title.replace(/^Group Coaching Round \d+/, `Group Coaching Round ${roundNumber}`)
}

// Summarise anything /api/groups could not do, for showing to the admin; null when all went well
export async function creationProblem(res: Response): Promise<string | null> {
  if (!res.ok) return `Groups could not be created (error ${res.status}).`
  const { problems } = await res.json().catch(() => ({ problems: [] }))
  if (!problems?.length) return null
  return `Some groups need attention:\n\n${problems.join('\n')}`
}
