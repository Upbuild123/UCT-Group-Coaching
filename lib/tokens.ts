import { createHmac } from 'crypto'

export interface DecisionTokenPayload {
  requestId: string
  decision: 'approved' | 'rejected'
  actorUserId: string
  iat: number
  exp: number
}

function secret(): string {
  const s = process.env.DECISION_TOKEN_SECRET
  if (!s) throw new Error('DECISION_TOKEN_SECRET is not set')
  return s
}

function b64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function signParts(header: string, body: string): string {
  return createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url')
}

export function createDecisionToken(
  requestId: string,
  decision: 'approved' | 'rejected',
  actorUserId: string
): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload: DecisionTokenPayload = {
    requestId,
    decision,
    actorUserId,
    iat: now,
    exp: now + 7 * 24 * 60 * 60,
  }
  const body = b64url(JSON.stringify(payload))
  const sig = signParts(header, body)
  return `${header}.${body}.${sig}`
}

export function verifyDecisionToken(token: string): DecisionTokenPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token format')
  const [header, body, sig] = parts
  const expected = signParts(header, body)
  if (sig !== expected) throw new Error('Invalid signature')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as DecisionTokenPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired')
  return payload
}
