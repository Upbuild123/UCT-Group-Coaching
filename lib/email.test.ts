import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({
  Resend: vi.fn(function () { return { emails: { send } } }),
}))

import { sendNoShowCheckEmail } from './email'

const email = {
  facilitatorEmail: 'f@upbuild.com',
  groupTitle: 'Group Coaching Round 1 Mary',
  startTimeFormatted: 'Nov 10, 2026 12:00 PM EST',
  students: [{ name: 'A', noShowUrl: 'https://x/a' }],
}

beforeEach(() => send.mockReset())

describe('sending email', () => {
  it('resolves when Resend accepts the email', async () => {
    send.mockResolvedValue({ data: { id: 'm1' }, error: null })
    await expect(sendNoShowCheckEmail(email)).resolves.toBeUndefined()
  })

  it('throws when Resend reports an error, so the email is not treated as sent', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'API key is invalid' } })
    await expect(sendNoShowCheckEmail(email)).rejects.toThrow('Email to f@upbuild.com failed: API key is invalid')
  })
})
