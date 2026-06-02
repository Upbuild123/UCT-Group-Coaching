# AI-Powered Slot Parser — Design Doc

Date: 2026-06-02

## Overview

Replace the regex-based plain-text slot parser (`lib/parser.ts`) with an OpenAI-powered version that can handle freeform input. The `ParsedSlot` interface and function signature are preserved; callers require only a minimal async change.

---

## What Changes

### `lib/parser.ts`

Replaced entirely. The new implementation:

1. Sends raw pasted text to `gpt-4o-mini` with a system prompt describing the expected JSON output schema
2. Uses OpenAI JSON mode to guarantee valid JSON response
3. Validates and returns `ParsedSlot[]`
4. On any error (API failure, malformed JSON), logs the error and returns `[]`

**Signature change:** `parseSlots` becomes async.

```typescript
// Before
export function parseSlots(input: string): ParsedSlot[]

// After
export async function parseSlots(input: string): Promise<ParsedSlot[]>
```

**`ParsedSlot` interface is unchanged:**

```typescript
export interface ParsedSlot {
  facilitatorName: string
  roundNumber: number
  dateTimeLocal: string  // ISO local datetime, e.g. "2026-03-05T12:00:00"
  timezone: string       // IANA timezone string, e.g. "America/New_York"
  capacity: number
}
```

### System prompt

The prompt instructs the model to:
- Extract all group coaching slots from the input
- Map timezone abbreviations (ET, CT, PT, MT) to IANA strings
- Return a JSON array matching the `ParsedSlot` schema
- Return an empty array `[]` if no valid slots are found

### `app/(admin)/rounds/[roundId]/new/page.tsx`

One-line change: `handleParse` adds `await` before `parseSlots(text)`.

---

## Model

`gpt-4o-mini` — sufficient for structured extraction, low cost, fast latency.

---

## Error Handling

- API call fails → log error, return `[]`, confirmation screen shows 0 slots
- OpenAI returns malformed JSON → catch parse error, return `[]`
- Input is empty → return `[]` immediately without calling API

---

## Testing

`lib/parser.test.ts` is updated to:
- Mock the OpenAI client
- Assert the correct prompt structure is sent
- Assert that valid JSON from the mock is returned as `ParsedSlot[]`
- Assert empty array is returned on API error

No real OpenAI API calls in tests.

---

## Dependencies

```bash
npm install openai
```

`OPENAI_API_KEY` must be set in `.env.local`.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/parser.ts` | Full replacement — async OpenAI implementation |
| `lib/parser.test.ts` | Updated tests with mocked OpenAI client |
| `app/(admin)/rounds/[roundId]/new/page.tsx` | Add `await` to `parseSlots` call in `handleParse` |
| `package.json` | Add `openai` dependency |
