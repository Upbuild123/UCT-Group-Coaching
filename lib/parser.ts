export interface ParsedSlot {
  facilitatorName: string
  roundNumber: number
  dateTimeLocal: string  // ISO wall-clock datetime e.g. "2026-03-05T12:00:00"
  timezone: string       // IANA timezone string e.g. "America/New_York"
  capacity: number
}

// Throws when the reader itself fails, so the admin isn't told their text had no sessions in it
export async function parseSlots(input: string): Promise<ParsedSlot[]> {
  if (!input.trim()) return []

  let res: Response
  try {
    res = await fetch('/api/parse-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Your admin session has expired. Please sign in again.')
  }
  if (!res.ok) {
    throw new Error(`The text reader isn't working right now (error ${res.status}). Check the System check page.`)
  }

  const { slots } = await res.json()
  return slots as ParsedSlot[]
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
