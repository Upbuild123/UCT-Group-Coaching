# Full Group Request Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to request entry into full group sessions, notify admin and facilitators by email with one-click approve/reject links, and process the decision (move signup, update calendar, notify student).

**Architecture:** Tokenized decision URLs (HMAC-SHA256 JWT, no extra packages) let facilitators approve/reject from email without logging in. A shared `lib/requests.ts` helper handles the approval/rejection logic used by both the facilitator token route and the admin form route. The student signup page gets a modal for submitting requests.

**Tech Stack:** Next.js App Router (Server Components + Route Handlers), Supabase (adminClient for writes), Resend (email), Google Calendar API, Node `crypto` (JWT signing), Vitest (unit tests for token lib)

---

## File Map

```
supabase/migrations/005_nullable_current_group.sql   — make current_group_session_id nullable
lib/tokens.ts                                        — JWT sign + verify helpers
lib/tokens.test.ts                                   — unit tests for token lib
lib/requests.ts                                      — shared approve/reject logic
lib/email.ts                                         — 5 new email functions (append)
app/api/requests/route.ts                            — POST: create request, send emails
app/api/requests/[id]/decide/route.ts                — GET: tokenized facilitator decision, redirect to result
app/requests/result/page.tsx                         — public result display page (no auth)
app/admin/requests/[id]/page.tsx                     — admin decision page (Server Component)
app/admin/requests/[id]/decide/route.ts              — POST: admin submits decision
app/admin/layout.tsx                                 — add Requests nav link
app/student/signup/page.tsx                          — add Request to join button + modal + pending state
middleware.ts                                        — exclude /requests from auth
.env                                                 — add DECISION_TOKEN_SECRET
```

---

## Task 1: DB Migration — Make current_group_session_id Nullable

**Files:**
- Create: `supabase/migrations/005_nullable_current_group.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/005_nullable_current_group.sql
alter table public.full_group_requests
  alter column current_group_session_id drop not null;
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_nullable_current_group.sql
git commit -m "feat: make current_group_session_id nullable for full group requests"
```

---

## Task 2: Environment Variable

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add secret to .env**

Open `.env` and append:

```
DECISION_TOKEN_SECRET=replace-with-a-long-random-string-at-least-32-chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate the secret value with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output as the value for `DECISION_TOKEN_SECRET`.

- [ ] **Step 2: Verify**

```bash
grep DECISION_TOKEN_SECRET .env
```

Expected: the line is present with a non-placeholder value.

---

## Task 3: Token Library

**Files:**
- Create: `lib/tokens.ts`
- Create: `lib/tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/tokens.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tokens --run
```

Expected: 5 failures with "cannot find module './tokens'"

- [ ] **Step 3: Implement lib/tokens.ts**

Create `lib/tokens.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tokens --run
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens.ts lib/tokens.test.ts
git commit -m "feat: add HMAC-SHA256 decision token sign/verify"
```

---

## Task 4: Email Functions

**Files:**
- Modify: `lib/email.ts`

Append 5 new exported functions to the existing file. The existing `FROM` constant and `resend` instance are already defined.

- [ ] **Step 1: Append new email functions to lib/email.ts**

Open `lib/email.ts` and append after the last existing function:

```typescript
export async function sendFullGroupRequestNotification({
  adminEmail,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  requestedRosterCount,
  requestedCapacity,
  currentGroupTitle,
  reason,
  adminRequestUrl,
}: {
  adminEmail: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  requestedRosterCount: number
  requestedCapacity: number
  currentGroupTitle: string | null
  reason: string | null
  adminRequestUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Full group request: ${studentName} → ${requestedGroupTitle}`,
    html: `
      <p><strong>${studentName}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${requestedGroupTitle}<br>
      ${requestedGroupFormatted}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${currentGroupTitle}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p><a href="${adminRequestUrl}" style="background:#2563eb;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Review Request</a></p>
      <p>— Upbuild Coaching</p>
    `,
  })
}

export async function sendFacilitatorRequestNotification({
  facilitatorEmail,
  facilitatorName,
  subject,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  requestedRosterCount,
  requestedCapacity,
  currentGroupTitle,
  reason,
  approveUrl,
  rejectUrl,
}: {
  facilitatorEmail: string
  facilitatorName: string
  subject: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  requestedRosterCount: number
  requestedCapacity: number
  currentGroupTitle: string | null
  reason: string | null
  approveUrl: string
  rejectUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: facilitatorEmail,
    subject,
    html: `
      <p>Hi ${facilitatorName},</p>
      <p><strong>${studentName}</strong> is requesting to join a full group.</p>
      <p><strong>Requested group:</strong> ${requestedGroupTitle}<br>
      ${requestedGroupFormatted}<br>
      Roster: ${requestedRosterCount}/${requestedCapacity}</p>
      ${currentGroupTitle ? `<p><strong>Current group:</strong> ${currentGroupTitle}</p>` : '<p>Student has no current group in this round.</p>'}
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>
        <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;margin-right:8px;">Approve</a>
        <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Reject</a>
      </p>
      <p style="font-size:12px;color:#6b7280;">Note: The first response wins. You will receive a follow-up once the request is resolved.</p>
      <p>— Upbuild Coaching</p>
    `,
  })
}

export async function sendFullGroupApprovalEmail({
  studentEmail,
  studentName,
  requestedGroupTitle,
  requestedGroupFormatted,
  facilitatorName,
}: {
  studentEmail: string
  studentName: string
  requestedGroupTitle: string
  requestedGroupFormatted: string
  facilitatorName: string
}) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: `You've been added to ${requestedGroupTitle}`,
    html: `
      <p>Hi ${studentName},</p>
      <p>Your request was approved. You've been added to <strong>${requestedGroupTitle}</strong> with ${facilitatorName}.</p>
      <p><strong>When:</strong> ${requestedGroupFormatted}</p>
      <p>Your calendar invite will be updated shortly.</p>
      <p>— Upbuild Coaching</p>
    `,
  })
}

export async function sendFullGroupRejectionEmail({
  studentEmail,
  studentName,
  requestedGroupTitle,
}: {
  studentEmail: string
  studentName: string
  requestedGroupTitle: string
}) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: 'Full group request update',
    html: `
      <p>Hi ${studentName},</p>
      <p>Your request to join <strong>${requestedGroupTitle}</strong> was not approved. You remain in your current group.</p>
      <p>Contact michael@upbuild.com if you have questions.</p>
      <p>— Upbuild Coaching</p>
    `,
  })
}

export async function sendFacilitatorResolutionEmail({
  facilitatorEmail,
  facilitatorName,
  studentName,
  requestedGroupTitle,
  decision,
}: {
  facilitatorEmail: string
  facilitatorName: string
  studentName: string
  requestedGroupTitle: string
  decision: 'approved' | 'rejected'
}) {
  await resend.emails.send({
    from: FROM,
    to: facilitatorEmail,
    subject: 'Full group request resolved',
    html: `
      <p>Hi ${facilitatorName},</p>
      <p>The full group request for <strong>${studentName}</strong> to join <strong>${requestedGroupTitle}</strong> has been <strong>${decision}</strong>.</p>
      <p>— Upbuild Coaching</p>
    `,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add full group request email functions"
```

---

## Task 5: Shared Decision Logic

**Files:**
- Create: `lib/requests.ts`

This module is imported by both the facilitator token route and the admin decide route.

- [ ] **Step 1: Create lib/requests.ts**

```typescript
import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { addAttendeeToEvent, removeAttendeeFromEvent } from '@/lib/calendar'
import {
  sendFullGroupApprovalEmail,
  sendFullGroupRejectionEmail,
  sendFacilitatorResolutionEmail,
} from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

export async function processDecision({
  requestId,
  decision,
  actorUserId,
  keepCurrentSlot = false,
  facilitatorField,
}: {
  requestId: string
  decision: 'approved' | 'rejected'
  actorUserId: string | null
  keepCurrentSlot?: boolean
  facilitatorField?: 'new_facilitator_decision' | 'old_facilitator_decision' | null
}): Promise<{ alreadyResolved: boolean }> {
  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!fgr || fgr.status !== 'pending') return { alreadyResolved: true }

  const extraFields: Record<string, string> = {}
  if (facilitatorField) extraFields[facilitatorField] = decision

  await adminClient
    .from('full_group_requests')
    .update({
      status: decision,
      decided_by_user_id: actorUserId,
      decided_at: new Date().toISOString(),
      ...extraFields,
    })
    .eq('id', requestId)

  const [studentRes, requestedGroupRes, currentGroupRes] = await Promise.all([
    adminClient.from('users').select('id, name, email').eq('id', fgr.student_id).single(),
    adminClient
      .from('group_sessions')
      .select('id, title, start_time_utc, original_timezone, capacity, status, calendar_event_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
      .eq('id', fgr.requested_group_session_id)
      .single(),
    fgr.current_group_session_id
      ? adminClient
          .from('group_sessions')
          .select('id, title, start_time_utc, original_timezone, capacity, calendar_event_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
          .eq('id', fgr.current_group_session_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const student = studentRes.data!
  const requestedGroup = requestedGroupRes.data!
  const currentGroup = currentGroupRes.data

  if (decision === 'rejected') {
    sendFullGroupRejectionEmail({
      studentEmail: student.email,
      studentName: student.name,
      requestedGroupTitle: requestedGroup.title,
    }).catch((err: unknown) => console.error('Rejection email failed', err))

    const requestedFacilitatorOnReject = (requestedGroup as any).users
    const currentFacilitatorOnReject = currentGroup ? (currentGroup as any).users : null
    const facilitatorsOnReject: Array<{ id: string; name: string; email: string }> = []
    if (requestedFacilitatorOnReject) facilitatorsOnReject.push(requestedFacilitatorOnReject)
    if (currentFacilitatorOnReject && currentFacilitatorOnReject.id !== requestedFacilitatorOnReject?.id) {
      facilitatorsOnReject.push(currentFacilitatorOnReject)
    }
    for (const f of facilitatorsOnReject) {
      sendFacilitatorResolutionEmail({
        facilitatorEmail: f.email,
        facilitatorName: f.name,
        studentName: student.name,
        requestedGroupTitle: requestedGroup.title,
        decision: 'rejected',
      }).catch((err: unknown) => console.error('Facilitator rejection notification failed', err))
    }

    await adminClient.from('audit_log').insert({
      actor_user_id: actorUserId,
      action: 'full_group_request.rejected',
      entity_type: 'full_group_request',
      entity_id: requestId,
      metadata: {},
    })

    return { alreadyResolved: false }
  }

  // APPROVED: insert new signup
  await adminClient.from('signups').insert({
    student_id: student.id,
    group_session_id: requestedGroup.id,
    round_id: fgr.round_id,
    status: 'confirmed',
    signup_type: 'admin_override',
  })

  const newCount = (requestedGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length + 1
  if (newCount >= requestedGroup.capacity) {
    await adminClient.from('group_sessions').update({ status: 'full' }).eq('id', requestedGroup.id)
  }

  if (currentGroup && !keepCurrentSlot) {
    await adminClient
      .from('signups')
      .update({ status: 'moved' })
      .eq('student_id', student.id)
      .eq('group_session_id', currentGroup.id)
      .eq('status', 'confirmed')

    // Re-open old group if removing this student drops it below capacity
    const oldConfirmed = (currentGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length
    if (oldConfirmed <= currentGroup.capacity) {
      await adminClient.from('group_sessions').update({ status: 'published' }).eq('id', currentGroup.id)
    }

    if (currentGroup.calendar_event_id) {
      removeAttendeeFromEvent({ calendarEventId: currentGroup.calendar_event_id, email: student.email })
        .catch((err: unknown) => console.error('Remove from old calendar failed', err))
    }
  }

  if (requestedGroup.calendar_event_id) {
    addAttendeeToEvent({
      calendarEventId: requestedGroup.calendar_event_id,
      email: student.email,
      displayName: student.name,
    }).catch((err: unknown) => console.error('Add to new calendar failed', err))
  }

  const requestedFormatted = formatInTimeZone(
    new Date(requestedGroup.start_time_utc),
    requestedGroup.original_timezone,
    'MMMM d, yyyy h:mm a zzz'
  )

  const requestedFacilitator = (requestedGroup as any).users
  sendFullGroupApprovalEmail({
    studentEmail: student.email,
    studentName: student.name,
    requestedGroupTitle: requestedGroup.title,
    requestedGroupFormatted: requestedFormatted,
    facilitatorName: requestedFacilitator?.name ?? '',
  }).catch((err: unknown) => console.error('Approval email failed', err))

  const facilitatorsToNotify: Array<{ id: string; name: string; email: string }> = []
  if (requestedFacilitator) facilitatorsToNotify.push(requestedFacilitator)
  const currentFacilitator = currentGroup ? (currentGroup as any).users : null
  if (currentFacilitator && currentFacilitator.id !== requestedFacilitator?.id) {
    facilitatorsToNotify.push(currentFacilitator)
  }

  for (const f of facilitatorsToNotify) {
    sendFacilitatorResolutionEmail({
      facilitatorEmail: f.email,
      facilitatorName: f.name,
      studentName: student.name,
      requestedGroupTitle: requestedGroup.title,
      decision: 'approved',
    }).catch((err: unknown) => console.error('Facilitator resolution email failed', err))
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: actorUserId,
    action: 'full_group_request.approved',
    entity_type: 'full_group_request',
    entity_id: requestId,
    metadata: { keep_current_slot: keepCurrentSlot },
  })

  return { alreadyResolved: false }
}

export async function getFacilitatorField(
  requestId: string,
  actorUserId: string
): Promise<'new_facilitator_decision' | 'old_facilitator_decision' | null> {
  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('requested_group_session_id, current_group_session_id')
    .eq('id', requestId)
    .single()

  if (!fgr) return null

  const { data: requestedGroup } = await adminClient
    .from('group_sessions')
    .select('facilitator_id')
    .eq('id', fgr.requested_group_session_id)
    .single()

  if (requestedGroup?.facilitator_id === actorUserId) return 'new_facilitator_decision'

  if (fgr.current_group_session_id) {
    const { data: currentGroup } = await adminClient
      .from('group_sessions')
      .select('facilitator_id')
      .eq('id', fgr.current_group_session_id)
      .single()
    if (currentGroup?.facilitator_id === actorUserId) return 'old_facilitator_decision'
  }

  return null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/requests.ts
git commit -m "feat: add shared full group request decision logic"
```

---

## Task 6: Create Request API Route

**Files:**
- Create: `app/api/requests/route.ts`

- [ ] **Step 1: Create app/api/requests/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createDecisionToken } from '@/lib/tokens'
import {
  sendFullGroupRequestNotification,
  sendFacilitatorRequestNotification,
} from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupSessionId, reason } = await request.json()

  const { data: group } = await adminClient
    .from('group_sessions')
    .select('id, title, start_time_utc, original_timezone, capacity, status, round_id, facilitator_id, users!facilitator_id(id, name, email), signups(id, status)')
    .eq('id', groupSessionId)
    .single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.status !== 'full') return NextResponse.json({ error: 'Group is not full' }, { status: 400 })

  const { data: existing } = await adminClient
    .from('full_group_requests')
    .select('id')
    .eq('student_id', user.id)
    .eq('requested_group_session_id', groupSessionId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request for this group' }, { status: 400 })
  }

  // Find student's current primary signup in this round (if any)
  const { data: currentSignup } = await adminClient
    .from('signups')
    .select('group_session_id, group_sessions(id, title, start_time_utc, original_timezone, users!facilitator_id(id, name, email))')
    .eq('student_id', user.id)
    .eq('round_id', group.round_id)
    .eq('status', 'confirmed')
    .eq('signup_type', 'primary')
    .maybeSingle()

  const currentGroupSessionId = currentSignup?.group_session_id ?? null

  const { data: fgr, error } = await adminClient
    .from('full_group_requests')
    .insert({
      student_id: user.id,
      round_id: group.round_id,
      current_group_session_id: currentGroupSessionId,
      requested_group_session_id: groupSessionId,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [studentRes, adminRes] = await Promise.all([
    adminClient.from('users').select('name, email').eq('id', user.id).single(),
    adminClient.from('users').select('email').eq('role', 'admin').single(),
  ])

  const student = studentRes.data!
  const adminEmail = adminRes.data?.email
  const requestedFacilitator = (group as any).users as { id: string; name: string; email: string }
  const currentGroup = currentSignup ? (currentSignup as any).group_sessions : null
  const currentFacilitator = currentGroup ? currentGroup.users : null

  const requestedGroupFormatted = formatInTimeZone(
    new Date(group.start_time_utc),
    group.original_timezone,
    'MMMM d, yyyy h:mm a zzz'
  )
  const requestedRosterCount = (group.signups ?? []).filter((s: any) => s.status === 'confirmed').length

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (adminEmail) {
    sendFullGroupRequestNotification({
      adminEmail,
      studentName: student.name,
      requestedGroupTitle: group.title,
      requestedGroupFormatted,
      requestedRosterCount,
      requestedCapacity: group.capacity,
      currentGroupTitle: currentGroup?.title ?? null,
      reason: reason ?? null,
      adminRequestUrl: `${baseUrl}/admin/requests/${fgr.id}`,
    }).catch((err: unknown) => console.error('Admin email failed', err))
  }

  const approveTokenRequested = createDecisionToken(fgr.id, 'approved', requestedFacilitator.id)
  const rejectTokenRequested = createDecisionToken(fgr.id, 'rejected', requestedFacilitator.id)

  sendFacilitatorRequestNotification({
    facilitatorEmail: requestedFacilitator.email,
    facilitatorName: requestedFacilitator.name,
    subject: `Full group request for your session: ${group.title}`,
    studentName: student.name,
    requestedGroupTitle: group.title,
    requestedGroupFormatted,
    requestedRosterCount,
    requestedCapacity: group.capacity,
    currentGroupTitle: currentGroup?.title ?? null,
    reason: reason ?? null,
    approveUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${approveTokenRequested}`,
    rejectUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${rejectTokenRequested}`,
  }).catch((err: unknown) => console.error('Requested facilitator email failed', err))

  if (currentFacilitator && currentFacilitator.id !== requestedFacilitator.id) {
    const approveTokenCurrent = createDecisionToken(fgr.id, 'approved', currentFacilitator.id)
    const rejectTokenCurrent = createDecisionToken(fgr.id, 'rejected', currentFacilitator.id)

    sendFacilitatorRequestNotification({
      facilitatorEmail: currentFacilitator.email,
      facilitatorName: currentFacilitator.name,
      subject: `Transfer request from your session: ${student.name}`,
      studentName: student.name,
      requestedGroupTitle: group.title,
      requestedGroupFormatted,
      requestedRosterCount,
      requestedCapacity: group.capacity,
      currentGroupTitle: currentGroup?.title ?? null,
      reason: reason ?? null,
      approveUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${approveTokenCurrent}`,
      rejectUrl: `${baseUrl}/api/requests/${fgr.id}/decide?token=${rejectTokenCurrent}`,
    }).catch((err: unknown) => console.error('Current facilitator email failed', err))
  }

  await adminClient.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'full_group_request.created',
    entity_type: 'full_group_request',
    entity_id: fgr.id,
    metadata: { requested_group_session_id: groupSessionId },
  })

  return NextResponse.json({ requestId: fgr.id })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/requests/route.ts
git commit -m "feat: add POST /api/requests to create full group requests"
```

---

## Task 7: Tokenized Facilitator Decision Route + Result Page

**Files:**
- Create: `app/api/requests/[id]/decide/route.ts`
- Create: `app/requests/result/page.tsx`
- Modify: `middleware.ts`

- [ ] **Step 1: Create tokenized decide route**

Create `app/api/requests/[id]/decide/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { verifyDecisionToken } from '@/lib/tokens'
import { processDecision, getFacilitatorField } from '@/lib/requests'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  let payload
  try {
    payload = verifyDecisionToken(token)
  } catch {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  if (payload.requestId !== id) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=invalid`)
  }

  const facilitatorField = await getFacilitatorField(id, payload.actorUserId)

  const { alreadyResolved } = await processDecision({
    requestId: id,
    decision: payload.decision,
    actorUserId: payload.actorUserId,
    keepCurrentSlot: false,
    facilitatorField,
  })

  if (alreadyResolved) {
    return NextResponse.redirect(`${baseUrl}/requests/result?outcome=already_resolved`)
  }

  return NextResponse.redirect(`${baseUrl}/requests/result?outcome=${payload.decision}`)
}
```

- [ ] **Step 2: Create result display page**

Create `app/requests/result/page.tsx`:

```typescript
export default async function RequestResultPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>
}) {
  const { outcome } = await searchParams

  const messages: Record<string, { heading: string; body: string; color: string }> = {
    approved: {
      heading: 'Request approved',
      body: 'The student has been added to the group. They will receive a confirmation email.',
      color: 'text-green-700',
    },
    rejected: {
      heading: 'Request rejected',
      body: 'The student has been notified that their request was not approved.',
      color: 'text-red-700',
    },
    already_resolved: {
      heading: 'Already resolved',
      body: 'This request has already been approved or rejected.',
      color: 'text-gray-700',
    },
    invalid: {
      heading: 'Invalid link',
      body: 'This link is invalid or has expired. Please contact michael@upbuild.com if you need help.',
      color: 'text-gray-700',
    },
  }

  const msg = messages[outcome ?? ''] ?? messages['invalid']

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <h1 className={`text-xl font-semibold mb-3 ${msg.color}`}>{msg.heading}</h1>
        <p className="text-gray-600 text-sm">{msg.body}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Exclude /requests from middleware auth**

Open `middleware.ts` and update the matcher to exclude `/requests`:

Find:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

Replace with:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|requests).*)'],
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/requests/[id]/decide/route.ts app/requests/result/page.tsx middleware.ts
git commit -m "feat: add tokenized facilitator decision route and result page"
```

---

## Task 8: Admin Decision Page + Route

**Files:**
- Create: `app/admin/requests/[id]/page.tsx`
- Create: `app/admin/requests/[id]/decide/route.ts`

- [ ] **Step 1: Create admin decision page**

Create `app/admin/requests/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'

export default async function AdminRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!fgr) redirect('/admin/dashboard')

  const [studentRes, requestedGroupRes, currentGroupRes] = await Promise.all([
    adminClient.from('users').select('name, email').eq('id', fgr.student_id).single(),
    adminClient
      .from('group_sessions')
      .select('id, title, start_time_utc, original_timezone, capacity, users!facilitator_id(name), signups(id, status)')
      .eq('id', fgr.requested_group_session_id)
      .single(),
    fgr.current_group_session_id
      ? adminClient
          .from('group_sessions')
          .select('id, title, start_time_utc, original_timezone, capacity, users!facilitator_id(name), signups(id, status)')
          .eq('id', fgr.current_group_session_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const student = studentRes.data!
  const requestedGroup = requestedGroupRes.data!
  const currentGroup = currentGroupRes.data
  const requestedFacilitator = (requestedGroup as any).users
  const currentFacilitator = currentGroup ? (currentGroup as any).users : null

  const requestedCount = (requestedGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length
  const currentCount = currentGroup ? (currentGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length : 0

  const requestedFormatted = formatInTimeZone(new Date(requestedGroup.start_time_utc), requestedGroup.original_timezone, 'MMMM d, yyyy h:mm a zzz')
  const currentFormatted = currentGroup ? formatInTimeZone(new Date(currentGroup.start_time_utc), currentGroup.original_timezone, 'MMMM d, yyyy h:mm a zzz') : null

  const alreadyResolved = fgr.status !== 'pending'

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Full Group Request</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Student</p>
          <p className="font-medium">{student.name}</p>
          <p className="text-sm text-gray-500">{student.email}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Requested Group</p>
          <p className="font-medium">{requestedGroup.title}</p>
          <p className="text-sm text-gray-500">{requestedFormatted}</p>
          <p className="text-sm text-gray-500">Facilitator: {requestedFacilitator?.name}</p>
          <p className="text-sm text-gray-500">Roster: {requestedCount}/{requestedGroup.capacity}</p>
        </div>

        {currentGroup ? (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Group</p>
            <p className="font-medium">{currentGroup.title}</p>
            <p className="text-sm text-gray-500">{currentFormatted}</p>
            <p className="text-sm text-gray-500">Facilitator: {currentFacilitator?.name}</p>
            <p className="text-sm text-gray-500">Roster: {currentCount}/{currentGroup.capacity}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Group</p>
            <p className="text-sm text-gray-500">None — student has no current group in this round</p>
          </div>
        )}

        {fgr.reason && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Student's Reason</p>
            <p className="text-sm">{fgr.reason}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className="text-sm font-medium capitalize">{fgr.status}</p>
        </div>
      </div>

      {alreadyResolved ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-700">
          This request has already been {fgr.status}.
        </div>
      ) : (
        <form method="POST" action={`/admin/requests/${id}/decide`} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <p className="font-medium mb-2">Decision</p>
            <label className="flex items-center gap-2 mb-2">
              <input type="radio" name="decision" value="approved" required /> Approve
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="decision" value="rejected" required /> Reject
            </label>
          </div>

          {currentGroup && (
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="keepCurrentSlot" value="true" />
                Keep student in their current group (treat new group as additional signup)
              </label>
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Submit Decision
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create admin decide route**

Create `app/admin/requests/[id]/decide/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { processDecision } from '@/lib/requests'
import { redirect } from 'next/navigation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const decision = formData.get('decision') as 'approved' | 'rejected'
  const keepCurrentSlot = formData.get('keepCurrentSlot') === 'true'

  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  await processDecision({
    requestId: id,
    decision,
    actorUserId: user.id,
    keepCurrentSlot,
    facilitatorField: null,
  })

  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/requests/[id]/page.tsx app/admin/requests/[id]/decide/route.ts
git commit -m "feat: add admin decision page and route for full group requests"
```

---

## Task 9: Skip — No Admin Nav Change Needed

Admin accesses individual request pages via email links. No separate requests list page exists in this MVP, so no nav entry is needed. Skip to Task 10.

---

## Task 10: Update Student Signup Page

**Files:**
- Modify: `app/student/signup/page.tsx`

This is the largest UI change. We add: (1) loading pending requests on mount, (2) a "Request to join" button replacing the disabled "Full" button, (3) a modal with optional reason field.

- [ ] **Step 1: Replace app/student/signup/page.tsx with the updated version**

Open `app/student/signup/page.tsx` and make the following changes:

**Add new state variables** after the existing state declarations (after `const [actionLoading, setActionLoading] = useState<string | null>(null)`):

```typescript
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set())
  const [modalGroupId, setModalGroupId] = useState<string | null>(null)
  const [modalReason, setModalReason] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
```

**Update `loadData`** to also fetch pending requests. Replace the `setLoading(false)` line and everything before the closing brace of `loadData` with:

```typescript
    // Load pending full group requests for this student
    const { data: pendingReqs } = await supabase
      .from('full_group_requests')
      .select('requested_group_session_id')
      .eq('student_id', user!.id)
      .eq('status', 'pending')

    setPendingRequests(new Set((pendingReqs ?? []).map((r: any) => r.requested_group_session_id)))
    setRounds(mapped)
    setLoading(false)
```

**Add `handleRequest` function** after `handleCancel`:

```typescript
  async function handleRequest(groupId: string) {
    setRequestLoading(true)
    setRequestError(null)
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupSessionId: groupId, reason: modalReason || undefined }),
    })
    if (res.ok) {
      setPendingRequests(prev => new Set([...prev, groupId]))
      setModalGroupId(null)
      setModalReason('')
    } else {
      const data = await res.json()
      setRequestError(data.error ?? 'Something went wrong')
    }
    setRequestLoading(false)
  }
```

**Replace the disabled Full button** in the JSX. Find:

```typescript
                  ) : isFull ? (
                    <button disabled className="text-xs px-3 py-1 border rounded text-gray-400 cursor-not-allowed">Full</button>
```

Replace with:

```typescript
                  ) : isFull ? (
                    pendingRequests.has(group.id) ? (
                      <button disabled className="text-xs px-3 py-1 border rounded text-gray-400 cursor-not-allowed">Request pending</button>
                    ) : (
                      <button
                        onClick={() => { setModalGroupId(group.id); setModalReason(''); setRequestError(null) }}
                        className="text-xs px-3 py-1 border border-blue-500 text-blue-600 rounded hover:bg-blue-50">
                        Request to join
                      </button>
                    )
```

**Add the modal** just before the closing `</div>` of the component's return (before the final `</div>`):

```typescript
      {modalGroupId && (() => {
        const modalGroup = round?.groups.find(g => g.id === modalGroupId)
        if (!modalGroup) return null
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h2 className="font-semibold text-lg mb-1">Request to join full group</h2>
              <p className="text-sm text-gray-600 mb-4">
                {modalGroup.facilitator_name} —{' '}
                {formatInTimeZone(new Date(modalGroup.start_time_utc), myTimezone, 'MMM d, yyyy h:mm a zzz')}
              </p>
              <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
              <textarea
                value={modalReason}
                onChange={e => setModalReason(e.target.value)}
                placeholder="Why do you want to join this group?"
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm mb-3 resize-none"
              />
              {requestError && (
                <p className="text-sm text-red-600 mb-3">{requestError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalGroupId(null)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleRequest(modalGroupId)}
                  disabled={requestLoading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {requestLoading ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/student/signup/page.tsx
git commit -m "feat: add Request to join button and modal for full groups"
```

---

## Task 11: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with no build errors.

- [ ] **Step 2: Test student flow**

1. Log in as a student
2. Navigate to `/student/signup`
3. Find a group with `status: full` (or manually update one in Supabase)
4. Click "Request to join" — modal should open
5. Enter an optional reason, click Submit
6. Button should change to "Request pending"
7. Check Supabase `full_group_requests` table — row should exist with `status: pending`
8. Check that 3 emails were sent (admin, requested facilitator, current facilitator if applicable)

- [ ] **Step 3: Test facilitator token flow**

1. Copy an approve or reject URL from the email (or generate one manually with `createDecisionToken`)
2. Open in browser while logged out
3. Should redirect to `/requests/result?outcome=approved` or `rejected`
4. Visiting the same URL again should redirect to `/requests/result?outcome=already_resolved`

- [ ] **Step 4: Test admin flow**

1. Log in as admin
2. Navigate to `/admin/requests/<id>` (copy the ID from Supabase)
3. Should see request details
4. Select Approve, optionally check "Keep student in current group", Submit
5. Should redirect to `/admin/dashboard`
6. Check Supabase — `full_group_requests.status` should be `approved`, new signup should exist

- [ ] **Step 5: Run unit tests**

```bash
npm run test:run
```

Expected: all tests pass including the 5 token tests.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete full group request workflow"
```
