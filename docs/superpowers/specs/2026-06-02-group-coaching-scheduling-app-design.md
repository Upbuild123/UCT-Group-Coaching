# Group Coaching Scheduling App — Design Doc

Date: 2026-06-02

## Overview

A scheduling app for the group coaching portion of the Upbuild Coaching Training program. Supports 4 rounds of group coaching per year. Admins create sessions, facilitators lead them, and students sign up. One program runs at a time.

---

## Stack

- **Framework:** Next.js 14 App Router (TypeScript)
- **Database / Auth:** Supabase (Postgres + Row-Level Security + Supabase Auth)
- **Email:** Resend
- **Calendar:** Google Calendar API (service account)
- **Timezone:** date-fns-tz
- **Deployment:** Vercel

---

## Project Structure

```
/app
  /admin          — dashboard, round/group management, user management, request queue
  /facilitator    — facilitator dashboard, rosters, transfer requests
  /student        — signup page, my sessions
  /api            — API routes (calendar, email)
/lib
  supabase.ts
  calendar.ts
  email.ts
  parser.ts
/components
  — shared UI components
```

---

## Auth and Roles

- Auth via Supabase Auth (email + password)
- Role stored on `users` table: `admin`, `facilitator`, `student`
- Row-Level Security enforces role-based data access
- Single admin account: Michael Sloyer (michael@upbuild.com), seeded directly
- No self-registration; admin manually creates all users

---

## Database Schema

### users
| column | type | notes |
|--------|------|-------|
| id | uuid PK | Supabase Auth user id |
| name | text | |
| email | text | unique |
| role | enum | admin, facilitator, student |
| timezone | text | IANA timezone string, default 'America/New_York' |
| created_at | timestamptz | |

### rounds
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| round_number | int | 1–4 |
| title | text | e.g. "Round 1" |
| signup_status | enum | closed, open, extra_signups_open |
| created_at | timestamptz | |

### group_sessions
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| round_id | uuid FK → rounds | |
| facilitator_id | uuid FK → users | |
| title | text | e.g. "Group Coaching Round 1 Gina" |
| notes | text | optional |
| start_time_utc | timestamptz | |
| end_time_utc | timestamptz | always start + 60 min, computed at insert |
| original_timezone | text | IANA timezone string |
| capacity | int | |
| status | enum | draft, published, full, canceled |
| calendar_event_id | text | Google Calendar event id |
| created_at | timestamptz | |

### signups
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| student_id | uuid FK → users | |
| group_session_id | uuid FK → group_sessions | |
| round_id | uuid FK → rounds | |
| status | enum | confirmed, canceled, moved |
| signup_type | enum | primary, additional, admin_override |
| created_at | timestamptz | |

### full_group_requests
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| student_id | uuid FK → users | |
| round_id | uuid FK → rounds | |
| current_group_session_id | uuid FK → group_sessions | |
| requested_group_session_id | uuid FK → group_sessions | |
| reason | text | optional, from student |
| status | enum | pending, approved, rejected, canceled |
| decided_by_user_id | uuid FK → users | first responder (facilitator or admin) |
| decided_at | timestamptz | |
| new_facilitator_decision | enum | approved, rejected, null |
| old_facilitator_decision | enum | approved, rejected, null |
| created_at | timestamptz | |

### audit_log
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| actor_user_id | uuid FK → users | |
| action | text | e.g. "signup.created", "request.approved" |
| entity_type | text | e.g. "signup", "full_group_request" |
| entity_id | uuid | |
| metadata | jsonb | arbitrary context |
| created_at | timestamptz | |

---

## Core Business Logic

### Plain-Text Slot Parser

1. Admin pastes text in the format:
   ```
   Gina:
   Round 1: March 5, 2026, 12:00 PM ET, capacity 5
   ```
2. Server parses text into structured slot objects.
3. Confirmation screen shows an editable table: facilitator, round, date, time, timezone, capacity, title, notes.
4. Admin confirms → groups created in DB as `draft` → Google Calendar events created immediately → facilitator receives calendar invite.
5. No calendar invites are sent before admin confirmation.

### Signup Flow

- Student views published groups by round tab.
- One primary signup per round during `open` status.
- Student can self-cancel anytime; seat opens immediately.
- Student can self-reschedule into any open slot (cancel existing + new signup, no approval needed).
- If admin enables `extra_signups_open` for a round, students already holding a slot may sign up for additional open groups.
- Race condition on last seat: handled with a Postgres transaction + row-level lock on the group session before inserting the signup.

### Full Group Request Flow

1. Student clicks "Request to join full group."
2. Request created with status `pending`.
3. Emails sent to admin + facilitator of requested group + facilitator of student's current group.
4. First facilitator or admin to respond wins; `decided_by_user_id` and `decided_at` recorded.
5. Admin can override any decision at any time.

**On approval:**
- Student signup moved to requested group (status → `moved` on old, new `confirmed` created).
- Student removed from old calendar event, added to new calendar event.
- Confirmation email sent to student; both facilitators and admin notified.

**On rejection:**
- Student remains in current group.
- Rejection email sent to student; admin and facilitators notified.

### Admin Overrides

- Admin can move any student to any group regardless of capacity or round rules.
- Admin can manually approve or reject any FullGroupRequest at any time.
- All admin actions written to audit_log.

---

## Email Notifications (Resend)

| Trigger | Recipients |
|---------|------------|
| Student signup confirmation | Student |
| Full group request submitted | Admin, facilitator of requested group, facilitator of current group |
| Full group request approved | Student, both facilitators, admin |
| Full group request rejected | Student, both facilitators, admin |
| Group canceled | Facilitator, all enrolled students |

---

## Calendar Integration (Google Calendar API)

- Service account owns and manages calendar events.
- Calendar event created when admin confirms slots; facilitator receives invite immediately.
- Event title format: `Group Coaching Round {N} {FacilitatorFirstName}`
- Student added to calendar invite on signup.
- Student removed from calendar invite on cancel or move; added to new event on move.
- Group cancellation updates or cancels the calendar event; facilitator and students notified.

---

## Timezone Handling

- All times stored in UTC.
- Default display timezone: US Eastern (`America/New_York`).
- Student selects timezone preference from dropdown (stored on user profile).
- Every group displays time in student's selected timezone, plus original timezone if different.

---

## Pages

### Admin
- **Dashboard** — 4 round cards: group count, signups, open seats, pending requests
- **Round Management** — paste plain text, review/edit parsed slots, publish groups, open/close signup, enable extra signups, export roster
- **Student Management** — create/edit students (name, email)
- **Facilitator Management** — create/edit facilitators (name, email)
- **Full Group Request Queue** — view pending requests, approve/reject

### Facilitator
- **Dashboard** — upcoming groups with rosters, pending transfer requests involving them, approve/reject buttons

### Student
- **Signup Page** — round tabs, available groups (facilitator, date/time in selected timezone, seats remaining), signup/cancel/reschedule buttons, "Request to join full group" on full groups
- **My Sessions** — confirmed groups across all 4 rounds

### Shared
- **Login Page** — email + password via Supabase Auth
- **Timezone Selector** — on user profile, defaults to US Eastern

---

## MVP Phasing

### Phase 1
- Admin creates rounds and groups (plain-text parser + confirmation screen)
- Student signup (one per round)
- Self-cancel and self-reschedule
- Calendar invite creation (facilitator on group creation, student on signup)
- Basic email notifications (signup confirmation, group cancellation)

### Phase 2
- Full group request workflow
- Facilitator approval/rejection by email
- Extra signup mode
- Facilitator dashboard

### Phase 3
- Reminders
- Waitlists
- Roster exports
- Analytics
- Advanced admin overrides

---

## Edge Cases

- Two students racing for the last seat → Postgres row-level lock in transaction
- Admin changes group time after students signed up → calendar event updated, students notified
- Student signs up for wrong timezone → self-reschedule flow handles it
- Group becomes over capacity via admin override → allowed, flagged in UI
- Full group request approved after requested group changes → validate group still exists and is appropriate before finalizing
- Calendar invite creation fails → log error, surface to admin, allow retry
- Email notification fails → log error, do not block the core action, allow retry
- Student added manually by admin → admin_override signup_type used
