# Full Group Request Workflow — Design

**Date:** 2026-06-06

## Overview

When a group session is full, students can submit a request to join it. The request is emailed to the admin and relevant facilitators, any of whom can approve or reject it. The first response wins. Admin has final authority and sees an additional option to keep or drop the student's current slot in the same round.

## Rules

- Any student can request to join any full group, regardless of whether they have a current signup in that round.
- A student cannot submit duplicate pending requests for the same group.
- First approval or rejection wins — subsequent clicks on email action links show a "already resolved" message.
- Admin can always override the outcome regardless of facilitator decisions (by acting first or via the admin page).

## Data Model

Uses the existing `full_group_requests` table:

```
full_group_requests
  id
  student_id
  round_id
  current_group_session_id   — nullable (student may not have a current group)
  requested_group_session_id
  reason                     — optional text from student
  status                     — pending | approved | rejected | canceled
  decided_by_user_id
  decided_at
  new_facilitator_decision   — approved | rejected | null
  old_facilitator_decision   — approved | rejected | null
  created_at
```

**Schema change required:** `current_group_session_id` is currently `NOT NULL` in the DB. Since students don't need a current group to submit a request, a migration must make it nullable.

## Token Design

Facilitator email action links use a signed JWT (HMAC-SHA256) to authorize decisions without requiring login.

**Payload:**
```json
{ "requestId": "<uuid>", "decision": "approved" | "rejected", "iat": 1234567890, "exp": 1234567890 }
```

- Signed with `DECISION_TOKEN_SECRET` env var
- Expiry: 7 days
- Implemented using Node's built-in `crypto` module — no extra packages
- One token per decision per recipient (each email has two links: one approve token, one reject token)

## Routes

### `POST /api/requests`
Creates a full group request and sends notification emails.

**Auth:** Student session required.

**Body:**
```json
{ "groupSessionId": "<uuid>", "reason": "<optional string>" }
```

**Logic:**
1. Validate student is authenticated
2. Check no existing pending request for same student + group
3. Insert `full_group_requests` row with `status: pending`
4. Look up student, requested group + facilitator, current group + facilitator (if any), admin user
5. Generate approve/reject JWT tokens for each facilitator recipient
6. Send notification emails (admin gets link to admin page, facilitators get tokenized links)
7. Insert audit log entry

**Errors:**
- 400 if group is not `full`
- 400 if duplicate pending request exists
- 401 if not authenticated

---

### `GET /api/requests/[id]/decide?token=<jwt>`
Tokenized decision endpoint for facilitators. Processes the decision and renders a result page.

**Auth:** None required — JWT provides authorization.

**Logic:**
1. Verify JWT signature and expiry
2. Load the request, check `status === 'pending'`
3. If not pending: render "already resolved" page
4. If pending: update `status`, `decided_by_user_id`, `decided_at`, set appropriate facilitator decision field
5. On approval: execute approval actions (see below)
6. On rejection: send rejection email to student
7. Render confirmation page ("Request approved" / "Request rejected")

---

### `GET /admin/requests/[id]`
Admin decision page. Requires admin login. Shows request details and a form with approve/reject and the keep/drop checkbox.

**Fields shown:**
- Student name
- Requested group (facilitator, date/time, current roster count)
- Current group if any (facilitator, date/time, roster count)
- Student's reason (if provided)
- Radio: Approve / Reject
- Checkbox (shown only when approving): "Keep student in current group" (default: unchecked = drop)

---

### `POST /admin/requests/[id]/decide`
Admin submits decision. Requires admin login.

**Body:**
```json
{ "decision": "approved" | "rejected", "keepCurrentSlot": true | false }
```

**Logic:** Same as tokenized decide endpoint but also handles `keepCurrentSlot`.

## Approval Actions

When approved:
1. Update `full_group_requests` status to `approved`
2. Insert new `signup` for student in requested group (`signup_type: admin_override`)
3. If student has current group and `keepCurrentSlot` is false: update existing signup `status: moved`
4. Update group statuses (`full` if at capacity)
5. Calendar: add student to requested group's event; remove from old group's event if slot dropped
6. Send approval email to student
7. Send notification emails to both facilitators
8. Insert audit log entries

When rejected:
1. Update `full_group_requests` status to `rejected`
2. Send rejection email to student
3. Insert audit log entry

## Email Notifications

### To admin (on new request)
- Subject: `Full group request: [Student Name] → [Group Title]`
- Body: student name, requested group, current group (if any), reason, roster counts
- Link to `/admin/requests/[id]` (requires login)

### To requested group facilitator (on new request)
- Subject: `Full group request for your session: [Group Title]`
- Body: student name, requested group, current group (if any), reason, roster counts
- Approve button → tokenized URL
- Reject button → tokenized URL

### To current group facilitator (on new request, if applicable)
- Subject: `Transfer request from your session: [Student Name]`
- Body: same details
- Approve button → tokenized URL
- Reject button → tokenized URL

### To student (on approval)
- Subject: `You've been added to [Group Title]`
- Body: new group details, facilitator, date/time

### To student (on rejection)
- Subject: `Full group request update`
- Body: the request was not approved, they remain in their current group (if any)

### To facilitators (on resolution)
- Subject: `Full group request resolved`
- Brief update on outcome

## UI Changes

### Student signup page (`app/student/signup/page.tsx`)

- Full group cards: replace disabled "Full" button with "Request to join" button
- Clicking opens a modal:
  - Shows group title, facilitator, date/time
  - Optional `<textarea>` for reason
  - Submit and Cancel buttons
- After submit: button changes to "Request pending" (disabled) for that card
- Prevent double-submit: check for existing pending request when loading the page

### Admin requests page (`app/admin/requests/[id]/page.tsx`)

- New page under `/admin/requests/[id]`
- Shows request details and decision form
- Approve/Reject radio, keep/drop checkbox (visible when Approve selected)
- Submit button posts to `POST /admin/requests/[id]/decide`

### Decision result page

- A Next.js page at `app/requests/[id]/decide/page.tsx` that reads the token from the query string, processes the decision server-side, and renders a confirmation or error message
- Shows success or "already resolved" message with no further actions needed

## Environment Variables

Add `DECISION_TOKEN_SECRET` — a random secret string used to sign JWTs. Must be set in `.env` and production environment.

## Error Handling

- JWT expired or invalid → render "This link is invalid or has expired" page
- Request already resolved → render "This request has already been resolved" page
- Calendar/email failures → logged but non-blocking (fire-and-forget, same pattern as existing code)
- Duplicate request submission → 400 with user-friendly message in the modal

## Files Affected

```
app/student/signup/page.tsx              — add Request to join button + modal
app/admin/requests/[id]/page.tsx         — new admin decision page
app/admin/requests/[id]/decide/route.ts  — admin decision API
app/admin/layout.tsx                     — add requests nav link if needed
app/api/requests/route.ts                — create request + send emails
app/requests/[id]/decide/page.tsx        — tokenized facilitator decision result page (no auth)
lib/email.ts                             — add 5 new email functions
lib/tokens.ts                            — JWT sign/verify helpers
supabase/migrations/005_nullable_current_group.sql  — make current_group_session_id nullable
.env                                     — add DECISION_TOKEN_SECRET
```
