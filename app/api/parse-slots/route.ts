import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { ParsedSlot } from '@/lib/parser'

const SYSTEM_PROMPT = `You are a scheduling data extractor for a group coaching program. Extract session slots and return a JSON object with a "slots" array.

Each slot must have exactly these fields:
- facilitatorName: string — the facilitator's first name (or full name if given)
- roundNumber: number — infer from order: the 1st slot per facilitator is Round 1, 2nd is Round 2, 3rd is Round 3, 4th is Round 4
- dateTimeLocal: string — ISO 8601 wall-clock datetime, e.g. "2026-11-12T17:30:00". If no year is given, use 2026.
- timezone: string — IANA timezone. Map: ET/EST/EDT → "America/New_York", CT/CST/CDT → "America/Chicago", MT/MST/MDT → "America/Denver", PT/PST/PDT → "America/Los_Angeles". If no timezone is given, inherit from the most recent line that had one.
- capacity: number — use 5 as default if not specified

The input can be in any reasonable format. The facilitator name may appear at the start of the first line, or on its own line before the dates. Dates may be abbreviated (e.g. "Nov 12", "Dec 3.", "Jan 7"). Times may be written as "5:30 pm", "12 pm", "2pm", etc.

Return ONLY: {"slots": [...]}
If no valid slots are found, return {"slots": []}.

Example input:
Gina Nov 12. 5:30 pm ET
Dec 3. 12 pm ET
Dec 11 2 pm ET
Jan 7 5:30 ET

Example output:
{"slots":[
  {"facilitatorName":"Gina","roundNumber":1,"dateTimeLocal":"2026-11-12T17:30:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":2,"dateTimeLocal":"2026-12-03T12:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":3,"dateTimeLocal":"2026-12-11T14:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":4,"dateTimeLocal":"2027-01-07T17:30:00","timezone":"America/New_York","capacity":5}
]}

Another supported format (explicit rounds and capacity):
Gina:
Round 1: March 5, 2026, 12:00 PM ET, capacity 6
Round 2: April 10, 2026, 1:00 PM ET, capacity 5`

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
