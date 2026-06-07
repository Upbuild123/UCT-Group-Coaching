# Edit Group Session — Design

**Date:** 2026-06-07

## Overview

Admins can edit a group session inline from the round detail page. Clicking Edit on a group row expands a panel with capacity controls and member management. Changes take effect immediately.

## UI

- Each non-canceled group row in `/admin/rounds/[roundId]` gets an **Edit** button in the actions column alongside "Remove group"
- Clicking Edit expands an inline panel below that row; clicking again (or Edit on another row) collapses it
- Only one group can be expanded at a time
- The expanded panel has two sections: Capacity and Members

## Capacity Section

- Number input showing current capacity, min = current confirmed signup count (cannot go below existing members)
- Save button — calls `PATCH /api/groups/[groupId]/capacity`
- On save: updates `group_sessions.capacity`, then recalculates status

## Members Section

- List of currently confirmed students: name, email, Remove button
- **Remove:** calls `DELETE /api/groups/[groupId]/signups/[signupId]`
  - Sets signup `status = 'canceled'`
  - Recalculates group status
  - Removes student from Google Calendar event
  - Silent — no email to student
- **Add student:** searchable dropdown of all students not already confirmed in this group
  - Add button calls `POST /api/groups/[groupId]/signups`
  - Creates signup with `signup_type = 'admin_override'`, `status = 'confirmed'`
  - Recalculates group status
  - Adds student to Google Calendar event
  - Sends confirmation email to student (reuse `sendFullGroupApprovalEmail` from `lib/email.ts`)

## Status Recalculation

Shared logic used by all three endpoints:
- Count signups for group where `status = 'confirmed'`
- If count >= capacity → set group `status = 'full'`
- If count < capacity and status is currently `full` → set group `status = 'published'`
- If group is `draft` → leave as `draft` (don't auto-publish)

## API Endpoints

### `PATCH /api/groups/[groupId]/capacity`
- Auth: admin required
- Body: `{ capacity: number }`
- Validates: capacity >= confirmed signup count
- Updates capacity, recalculates status

### `DELETE /api/groups/[groupId]/signups/[signupId]`
- Auth: admin required
- Validates: signup belongs to this group
- Cancels signup, recalculates status, removes from Google Calendar

### `POST /api/groups/[groupId]/signups`
- Auth: admin required
- Body: `{ studentId: string }`
- Validates: student not already confirmed in this group
- Creates admin_override signup, recalculates status, adds to Google Calendar, sends confirmation email

## Files Affected

```
app/admin/rounds/[roundId]/page.tsx          — add Edit button, inline expand panel (client component)
app/admin/rounds/[roundId]/GroupEditor.tsx   — new client component for the expanded edit panel
app/api/groups/[groupId]/capacity/route.ts   — PATCH capacity
app/api/groups/[groupId]/signups/route.ts    — POST add student
app/api/groups/[groupId]/signups/[signupId]/route.ts  — DELETE remove student
```

## Email

On student add: reuse `sendFullGroupApprovalEmail(student, groupSession, facilitator)` from `lib/email.ts`.
On student remove: no email.
