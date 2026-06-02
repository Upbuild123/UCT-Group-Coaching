# Group Coaching Scheduling App Spec

## Purpose

Build a scheduling app for the group coaching portion of the Upbuild Coaching Training program.

The app supports 4 rounds of group coaching. In each round, students sign up for one group coaching session led by an Upbuild facilitator. Admins create the available sessions, facilitators lead them, and students choose sessions based on availability.

## Core Roles

### Admin
Can:
- Create and manage rounds
- Create and edit facilitators
- Create and edit students
- Add group coaching slots in plain text
- Set max students per group
- Override signups
- Approve or reject transfer requests
- Allow or disallow extra signups after initial signup period
- View all rounds, groups, rosters, and waitlist or transfer requests

### Facilitator
Can:
- View their assigned groups
- See student rosters
- Receive email notifications for full-group transfer requests
- Approve or reject transfer requests that affect their group

### Student
Can:
- Choose timezone display preference
- View available groups by round
- Sign up for one group per round during the initial signup period
- Later sign up for additional open slots if admin enables that option
- Request entry into a full group
- See their confirmed group coaching sessions

## Rounds

There are always 4 group coaching rounds:

- Round 1
- Round 2
- Round 3
- Round 4

Each round contains approximately 4 to 6 groups, but this should be configurable.

Each group has:
- Round number
- Facilitator
- Date and time
- Timezone
- Capacity, usually 4 to 6 students
- Calendar event
- Student roster
- Status: draft, published, full, canceled

## Admin Plain Text Slot Creation

The admin should be able to paste plain text such as:

Gina:
Round 1: March 5, 2026, 12:00 PM ET, capacity 5
Round 1: March 6, 2026, 3:00 PM ET, capacity 5
Round 2: April 10, 2026, 1:00 PM ET, capacity 6

Rasanath:
Round 1: March 5, 2026, 5:00 PM ET, capacity 4
Round 2: April 11, 2026, 12:00 PM ET, capacity 5

The app should parse this into structured slots and show an editable confirmation screen before creating the groups.

Admin should be able to edit:
- Facilitator
- Round
- Date
- Time
- Timezone
- Capacity
- Title
- Notes

No calendar invitations should be sent until the admin confirms.

## Signup Rules

### Initial Signup Period
Students may sign up for only 1 group per round.

Example:
A student can sign up for:
- Round 1, Gina
- Round 2, Hari
- Round 3, Vipin
- Round 4, Rasanath

But cannot sign up for two Round 1 groups unless extra signups are enabled.

### Extra Signup Mode
Admin can enable “allow additional signups” for each round.

When enabled:
- Students who already have a slot in that round can sign up for additional open groups.
- They cannot take a full group slot unless they submit a request.
- Admin can set a max number of additional signups if desired.

## Full Group Requests

If a student wants to join a full group, they can click “Request to join full group.”

The student must already be assigned to another group in that same round unless the admin overrides this.

Request should include:
- Student name
- Round
- Current group
- Requested full group
- Optional reason from student

Email notifications should go to:
- Admin
- Facilitator of requested new group
- Facilitator of student’s current group

Each email should include:
- Student name
- Current group
- Requested group
- Current group roster count
- Requested group roster count
- Approve button
- Reject button

Approval rule:
- Any facilitator involved can approve or reject, or admin can make the final decision.
- Recommended default: admin has final authority, but facilitator approvals are captured.
- App should track who approved or rejected and when.

When approved:
- Student is moved into the requested group.
- Student is removed from old group unless admin marks it as an additional signup.
- Calendar invite is updated.
- Student receives confirmation email.
- Both facilitators receive update email.

When rejected:
- Student remains in current group.
- Student receives rejection email.
- Admin and facilitators are notified.

## Calendar Integration

When admin creates and confirms time slots:
- Calendar events should be created immediately.
- Initial invite should be sent only to the facilitator.
- Event title format:

Group Coaching Round 1 Gina

When students sign up:
- Student is added to the calendar invitation.
- Calendar invite is updated automatically.

When students move groups:
- Student is removed from old calendar event.
- Student is added to new calendar event.

When a group is canceled:
- Calendar event is canceled or updated.
- Facilitator and students are notified.

## Timezones

Default display timezone:
- US Eastern Time

Student can select timezone from a dropdown.

Every group should show:
- Time in selected timezone
- Original timezone if different

Example:
March 5, 2026, 12:00 PM ET  
Your timezone: March 6, 2026, 2:00 AM JST

All stored times should use UTC internally.

## Email Notifications

Send emails for:
- Student signup confirmation
- Facilitator notification when a student joins
- Full group request submitted
- Full group request approved
- Full group request rejected
- Calendar event changes
- Admin publishing a round
- Reminder before session, optional

## Data Model

### User
- id
- name
- email
- role: admin, facilitator, student
- timezone
- created_at

### Round
- id
- program_id
- round_number
- title
- signup_status: closed, open, extra_signups_open
- created_at

### GroupSession
- id
- round_id
- facilitator_id
- title
- start_time_utc
- end_time_utc
- original_timezone
- capacity
- status: draft, published, full, canceled
- calendar_event_id
- created_at

### Signup
- id
- student_id
- group_session_id
- round_id
- status: confirmed, canceled, moved
- signup_type: primary, additional, admin_override
- created_at

### FullGroupRequest
- id
- student_id
- round_id
- current_group_session_id
- requested_group_session_id
- reason
- status: pending, approved, rejected, canceled
- admin_decision_by
- admin_decision_at
- new_facilitator_decision
- old_facilitator_decision
- created_at

### AuditLog
- id
- actor_user_id
- action
- entity_type
- entity_id
- metadata
- created_at

## Main Pages

### Admin Dashboard
Shows:
- Program
- Rounds 1 to 4
- Number of groups per round
- Number of students signed up
- Open seats
- Full groups
- Pending requests

### Round Management Page
Admin can:
- Add groups
- Paste plain text slot info
- Edit groups
- Publish groups
- Open or close signup
- Enable extra signups
- Export roster

### Student Signup Page
Student sees:
- Round tabs
- Available groups
- Facilitator name
- Date and time
- Available seats
- Signup button
- Request full group button

### Facilitator Dashboard
Facilitator sees:
- Their upcoming groups
- Rosters
- Pending transfer requests involving them

## Important Edge Cases

- Two students try to take the last seat at the same time
- Facilitator has multiple groups in the same round
- Admin changes a group time after students signed up
- Student cancels a signup
- Student signs up for wrong timezone
- Group becomes over capacity through admin override
- Full group request is approved after the requested group changes
- Calendar invite creation fails
- Email notification fails
- Student is added manually by admin
- Facilitator changes after calendar event is already created

## Suggested MVP

Phase 1:
- Admin creates rounds and groups
- Plain text slot parser
- Student signup
- One signup per round
- Calendar invite creation
- Student added to calendar event
- Basic email notifications

Phase 2:
- Full group request workflow
- Facilitator approval and rejection by email
- Extra signup mode
- Facilitator dashboard

Phase 3:
- Reminders
- Waitlists
- Analytics
- Roster exports
- Advanced admin overrides

## Clarifications

### Auth and User Provisioning
- There is one admin: Michael Sloyer (michael@upbuild.com).
- Admin manually creates all users by copying and pasting names and emails.
- No self-registration. No email-based invite flow required.

### Program Scope
- Only one coaching program runs at a time (one per year).
- The `program_id` on Round is vestigial for v1 — no multi-program support needed.

### Session Duration
- All group sessions are exactly 60 minutes.
- `end_time_utc` is always `start_time_utc + 60 minutes`. No manual entry needed.

### Student Cancellation and Rescheduling
- Students can cancel their own signups.
- Students can self-reschedule into any open slot without admin approval.
- Switching into a full group requires a FullGroupRequest (existing flow).
- Cancellation opens the seat back up immediately.

### FullGroupRequest Approval Tie-breaker
- First facilitator response (approve or reject) wins.
- Admin can always override the outcome regardless.

### Calendar Integration
- Calendar invites are sent to personal email addresses (not a shared org calendar).
- Facilitator receives invite when admin confirms the slot.
- Students receive/are added to the invite when they sign up.

## Recommended Tech Notes for Claude Code

Use:
- Next.js app
- Supabase or Postgres database
- Google Calendar API
- Resend for email
- Auth with role-based permissions
- UTC for all stored times
- Timezone conversion using date-fns-tz or Luxon

The app should prioritize reliability over cleverness. Scheduling mistakes are costly, so every parsed input and calendar change should have a confirmation step before it is finalized.