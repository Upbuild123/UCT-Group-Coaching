import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDecisionToken, verifyDecisionToken } from './tokens'

const SECRET = 'test-secret-value'

beforeEach(() => {
  process.env.DECISION_TOKEN_SECRET = SECRET
})

afterEach(() => {
  delete process.env.DECISION_TOKEN_SECRET
  vi.useRealTimers()
})

describe('createDecisionToken / verifyDecisionToken', () => {
  it('round-trips a valid token', () => {
    const token = createDecisionToken('req-123', 'approved', 'user-456')
    const payload = verifyDecisionToken(token)
    expect(payload.requestId).toBe('req-123')
    expect(payload.decision).toBe('approved')
    expect(payload.actorUserId).toBe('user-456')
  })

  it('rejects a token signed with a different secret', () => {
    const token = createDecisionToken('req-123', 'approved', 'user-456')
    process.env.DECISION_TOKEN_SECRET = 'wrong-secret'
    expect(() => verifyDecisionToken(token)).toThrow('Invalid signature')
  })

  it('rejects a tampered payload', () => {
    const token = createDecisionToken('req-123', 'approved', 'user-456')
    const parts = token.split('.')
    const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({ requestId: 'evil', decision: 'approved', actorUserId: 'user-456', iat: 0, exp: 9999999999 })).toString('base64url') + '.' + parts[2]
    expect(() => verifyDecisionToken(tampered)).toThrow('Invalid signature')
  })

  it('rejects an expired token', () => {
    vi.useFakeTimers()
    const token = createDecisionToken('req-123', 'approved', 'user-456')
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000) // 8 days
    expect(() => verifyDecisionToken(token)).toThrow('Token expired')
  })

  it('rejects a malformed token', () => {
    expect(() => verifyDecisionToken('not.a.valid.jwt.at.all')).toThrow()
  })
})
