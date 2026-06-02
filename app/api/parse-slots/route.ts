import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { ParsedSlot } from '@/lib/parser'

const SYSTEM_PROMPT = `You are a scheduling assistant for a group coaching program with 4 rounds. Parse the input and return a JSON object with a "slots" array.

Each slot must have exactly these fields:
- facilitatorName: string — first name or full name
- roundNumber: number — infer from order per facilitator: 1st slot = Round 1, 2nd = Round 2, 3rd = Round 3, 4th = Round 4
- dateTimeLocal: string — ISO 8601 wall-clock datetime e.g. "2026-11-12T17:30:00". Assume year 2026 unless stated. If a date rolls past Dec 31, use 2027.
- timezone: string — IANA timezone. ET/EST/EDT → "America/New_York", CT/CST/CDT → "America/Chicago", MT/MST/MDT → "America/Denver", PT/PST/PDT → "America/Los_Angeles". Inherit from the most recent line that had a timezone if omitted.
- capacity: number — default 6 unless specified

The input may include natural language instructions like "change all to capacity 5" or "set Gina's groups to capacity 4". Apply those instructions to the relevant slots.

Accept any reasonable date/time format. The facilitator name may be inline with the first date or on its own line.

Return ONLY: {"slots": [...]}
If no valid slots found: {"slots": []}

Example input:
Gina Nov 12. 5:30 pm ET
Dec 3. 12 pm ET
Dec 11 2 pm ET
Jan 7 5:30 ET

Vipin Nov 14 10am ET
Dec 5 2pm ET
Dec 19 11am ET
Jan 9 3pm ET

Change all to capacity 5

Example output:
{"slots":[
  {"facilitatorName":"Gina","roundNumber":1,"dateTimeLocal":"2026-11-12T17:30:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":2,"dateTimeLocal":"2026-12-03T12:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":3,"dateTimeLocal":"2026-12-11T14:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":4,"dateTimeLocal":"2027-01-07T17:30:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Vipin","roundNumber":1,"dateTimeLocal":"2026-11-14T10:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Vipin","roundNumber":2,"dateTimeLocal":"2026-12-05T14:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Vipin","roundNumber":3,"dateTimeLocal":"2026-12-19T11:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Vipin","roundNumber":4,"dateTimeLocal":"2027-01-09T15:00:00","timezone":"America/New_York","capacity":5}
]}`

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

function isValidSlot(s: unknown): s is ParsedSlot {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return (
    typeof o.facilitatorName === 'string' &&
    typeof o.roundNumber === 'number' &&
    typeof o.dateTimeLocal === 'string' &&
    typeof o.timezone === 'string' &&
    typeof o.capacity === 'number'
  )
}

export async function POST(request: Request) {
  let input: string
  try {
    const body = await request.json() as { input?: string }
    input = body.input ?? ''
  } catch {
    return NextResponse.json({ slots: [] }, { status: 400 })
  }

  if (!input.trim()) return NextResponse.json({ slots: [] })
  if (input.length > 10_000) return NextResponse.json({ slots: [] }, { status: 400 })

  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      temperature: 0,
      max_tokens: 2048,
    })

    const choice = response.choices[0]
    if (choice.finish_reason !== 'stop') {
      console.warn('parse-slots: unexpected finish_reason', choice.finish_reason)
    }

    const content = choice?.message?.content
    if (!content) return NextResponse.json({ slots: [] })

    const parsed = JSON.parse(content)
    const raw: unknown[] = Array.isArray(parsed.slots) ? parsed.slots : []
    const slots = raw.filter(isValidSlot)

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('parse-slots: OpenAI call failed', err)
    return NextResponse.json({ slots: [] }, { status: 500 })
  }
}
