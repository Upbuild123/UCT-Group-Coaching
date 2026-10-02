import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const get = vi.fn()
const patch = vi.fn()
const insert = vi.fn()
vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: vi.fn() },
    calendar: () => ({ events: { get, patch, insert } }),
  },
}))

import { addAttendeeToEvent, removeAttendeeFromEvent, createCalendarEvent } from './calendar'

const existing = [{ email: 'facilitator@upbuild.com' }]

beforeEach(() => {
  get.mockReset()
  patch.mockReset()
})

describe('addAttendeeToEvent', () => {
  it('writes conditionally on the etag it read', async () => {
    get.mockResolvedValue({ data: { etag: '"v1"', attendees: existing } })
    patch.mockResolvedValue({})

    await addAttendeeToEvent({ calendarEventId: 'e1', email: 'a@x.com', displayName: 'A' })

    expect(patch).toHaveBeenCalledTimes(1)
    const [params, options] = patch.mock.calls[0]
    expect(params.requestBody.attendees).toEqual([...existing, { email: 'a@x.com', displayName: 'A' }])
    expect(params.requestBody.guestsCanSeeOtherGuests).toBe(false)
    expect(options.headers['If-Match']).toBe('"v1"')
  })

  it('re-reads and retries when another change got there first', async () => {
    get
      .mockResolvedValueOnce({ data: { etag: '"v1"', attendees: existing } })
      .mockResolvedValueOnce({ data: { etag: '"v2"', attendees: [...existing, { email: 'b@x.com' }] } })
    patch.mockRejectedValueOnce({ code: 412 }).mockResolvedValueOnce({})

    await addAttendeeToEvent({ calendarEventId: 'e1', email: 'a@x.com', displayName: 'A' })

    expect(patch).toHaveBeenCalledTimes(2)
    const [params, options] = patch.mock.calls[1]
    // b@x.com, added by the other change, is kept
    expect(params.requestBody.attendees.map((a: { email: string }) => a.email))
      .toEqual(['facilitator@upbuild.com', 'b@x.com', 'a@x.com'])
    expect(options.headers['If-Match']).toBe('"v2"')
  })

  it('does not write when the attendee is already on the invite', async () => {
    get.mockResolvedValue({ data: { etag: '"v1"', attendees: [{ email: 'a@x.com' }] } })
    await addAttendeeToEvent({ calendarEventId: 'e1', email: 'a@x.com', displayName: 'A' })
    expect(patch).not.toHaveBeenCalled()
  })

  it('passes through errors other than conflicts', async () => {
    get.mockResolvedValue({ data: { etag: '"v1"', attendees: existing } })
    patch.mockRejectedValue({ code: 500 })
    await expect(addAttendeeToEvent({ calendarEventId: 'e1', email: 'a@x.com', displayName: 'A' }))
      .rejects.toEqual({ code: 500 })
    expect(patch).toHaveBeenCalledTimes(1)
  })
})

describe('removeAttendeeFromEvent', () => {
  it('removes only that attendee', async () => {
    get.mockResolvedValue({ data: { etag: '"v1"', attendees: [...existing, { email: 'a@x.com' }] } })
    patch.mockResolvedValue({})
    await removeAttendeeFromEvent({ calendarEventId: 'e1', email: 'a@x.com' })
    expect(patch.mock.calls[0][0].requestBody.attendees).toEqual(existing)
  })
})

describe('createCalendarEvent', () => {
  it('invites the facilitator with the guest list hidden', async () => {
    insert.mockResolvedValue({ data: { id: 'e1' } })
    await createCalendarEvent({
      title: 'Group Coaching Round 1 Gina',
      startUtc: new Date('2026-11-25T00:00:00Z'),
      endUtc: new Date('2026-11-25T01:00:00Z'),
      facilitatorEmail: 'gina@upbuild.com',
      facilitatorName: 'Gina',
    })
    const body = insert.mock.calls[0][0].requestBody
    expect(body.attendees).toEqual([{ email: 'gina@upbuild.com', displayName: 'Gina' }])
    expect(body.guestsCanSeeOtherGuests).toBe(false)
  })
})
