import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { ParsedSlot } from '@/lib/parser'

const SYSTEM_PROMPT = `You are a scheduling data extractor. Extract group coaching session slots from the input text and return them as a JSON object with a "slots" array.

Each slot must have exactly these fields:
- facilitatorName: string — the facilitator's first name (or full name if given)
- roundNumber: number — the round number (1, 2, 3, or 4)
- dateTimeLocal: string — ISO 8601 local datetime without timezone offset, e.g. "2026-03-05T12:00:00"
- timezone: string — IANA timezone string. Map abbreviations: ET/EST/EDT → "America/New_York", CT/CST/CDT → "America/Chicago", MT/MST/MDT → "America/Denver", PT/PST/PDT → "America/Los_Angeles"
- capacity: number — maximum number of students

Return ONLY a valid JSON object like: {"slots": [...]}
If no valid slots are found, return {"slots": []}.

Example input:
Gina:
Round 1: March 5, 2026, 12:00 PM ET, capacity 5
Round 2: April 10, 2026, 1:00 PM ET, capacity 6

Example output:
{"slots":[
  {"facilitatorName":"Gina","roundNumber":1,"dateTimeLocal":"2026-03-05T12:00:00","timezone":"America/New_York","capacity":5},
  {"facilitatorName":"Gina","roundNumber":2,"dateTimeLocal":"2026-04-10T13:00:00","timezone":"America/New_York","capacity":6}
]}`

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  const { input } = await request.json() as { input: string }

  if (!input?.trim()) {
    return NextResponse.json({ slots: [] })
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return NextResponse.json({ slots: [] })

    const parsed = JSON.parse(content)
    const slots: ParsedSlot[] = Array.isArray(parsed)
      ? parsed
      : (parsed.slots ?? [])

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('parse-slots: OpenAI call failed', err)
    return NextResponse.json({ slots: [] }, { status: 500 })
  }
}
