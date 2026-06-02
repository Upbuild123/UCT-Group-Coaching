export interface ParsedSlot {
  facilitatorName: string
  roundNumber: number
  dateTimeLocal: string
  timezone: string
  capacity: number
}

const TIMEZONE_MAP: Record<string, string> = {
  ET: 'America/New_York',
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CT: 'America/Chicago',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  MT: 'America/Denver',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PT: 'America/Los_Angeles',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
}

const SLOT_REGEX =
  /^Round\s+(\d):\s+(.+?),\s+(\d{1,2}:\d{2}\s+[AP]M)\s+([A-Z]{2,3}),\s+capacity\s+(\d+)$/i

function parseDateTime(dateStr: string, timeStr: string): string {
  const date = new Date(`${dateStr} ${timeStr}`)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
}

export function parseSlots(input: string): ParsedSlot[] {
  const results: ParsedSlot[] = []
  if (!input.trim()) return results

  let currentFacilitator: string | null = null

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.endsWith(':') && !line.startsWith('Round')) {
      currentFacilitator = line.slice(0, -1).trim()
      continue
    }

    if (!currentFacilitator) continue

    const match = line.match(SLOT_REGEX)
    if (!match) continue

    const [, roundStr, dateStr, timeStr, tzAbbr, capacityStr] = match
    const timezone = TIMEZONE_MAP[tzAbbr.toUpperCase()]
    if (!timezone) continue

    try {
      results.push({
        facilitatorName: currentFacilitator,
        roundNumber: parseInt(roundStr, 10),
        dateTimeLocal: parseDateTime(dateStr, timeStr),
        timezone,
        capacity: parseInt(capacityStr, 10),
      })
    } catch {
      // skip malformed lines
    }
  }

  return results
}
