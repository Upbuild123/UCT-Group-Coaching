# Edit Group Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to edit group sessions inline — adjusting capacity and adding/removing students — from the round detail page.

**Architecture:** Three new API routes handle capacity updates, student add, and student remove. A new `GroupEditor` client component renders the inline expand panel. The round detail page becomes a client component to manage which group is expanded. Status recalculation (full/published) is shared logic in each route.

**Tech Stack:** Next.js 16 App Router, Supabase (adminClient for writes), Google Calendar API (addAttendeeToEvent / removeAttendeeFromEvent), Resend email (sendFullGroupApprovalEmail), TypeScript, Tailwind CSS.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/admin/rounds/[roundId]/page.tsx` | Modify | Convert to client component, add Edit button, render GroupEditor |
| `app/admin/rounds/[roundId]/GroupEditor.tsx` | Create | Inline expand panel — capacity + members UI |
| `app/api/groups/[groupId]/capacity/route.ts` | Create | PATCH — update capacity + recalculate status |
| `app/api/groups/[groupId]/signups/route.ts` | Create | POST — add student (admin override) |
| `app/api/groups/[groupId]/signups/[signupId]/route.ts` | Create | DELETE — remove student |

---

### Task 1: PATCH /api/groups/[groupId]/capacity

**Files:**
- Create: `app/api/groups/[groupId]/capacity/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/groups/[groupId]/capacity/route.ts
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function recalculateStatus(groupId: string, newCapacity: number) {
  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const newStatus = confirmed >= newCapacity ? 'full' : 'published'
  await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { capacity } = await request.json() as { capacity: number }

  if (typeof capacity !== 'number' || capacity < 1) {
    return NextResponse.json({ error: 'Invalid capacity' }, { status: 400 })
  }

  // Check capacity >= confirmed count
  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  if ((count ?? 0) > capacity) {
    return NextResponse.json({ error: `Capacity cannot be less than current signups (${count})` }, { status: 400 })
  }

  await adminClient.from('group_sessions').update({ capacity }).eq('id', groupId)
  await recalculateStatus(groupId, capacity)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Test manually**

Start dev server (`npm run dev`), open browser console and run:
```js
fetch('/api/groups/SOME_GROUP_ID/capacity', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ capacity: 3 })
}).then(r => r.json()).then(console.log)
```
Expected: `{ ok: true }` and group capacity updated in Supabase.

- [ ] **Step 3: Commit**

```bash
git add app/api/groups/[groupId]/capacity/route.ts
git commit -m "feat: PATCH /api/groups/[groupId]/capacity"
```

---

### Task 2: POST /api/groups/[groupId]/signups (add student)

**Files:**
- Create: `app/api/groups/[groupId]/signups/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/groups/[groupId]/signups/route.ts
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { addAttendeeToEvent } from '@/lib/calendar'
import { sendFullGroupApprovalEmail } from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

async function recalculateStatus(groupId: string) {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('capacity, status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const newStatus = confirmed >= group.capacity ? 'full' : 'published'
  await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { studentId } = await request.json() as { studentId: string }
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  // Check not already confirmed
  const { data: existing } = await adminClient
    .from('signups')
    .select('id')
    .eq('group_session_id', groupId)
    .eq('student_id', studentId)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Student already in this group' }, { status: 400 })

  // Load group and student
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('*, users!facilitator_id(name, email), round_id, calendar_event_id')
    .eq('id', groupId)
    .single()

  const { data: student } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('id', studentId)
    .single()

  if (!group || !student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Create signup
  await adminClient.from('signups').insert({
    student_id: studentId,
    group_session_id: groupId,
    round_id: group.round_id,
    status: 'confirmed',
    signup_type: 'admin_override',
  })

  await recalculateStatus(groupId)

  // Calendar + email fire-and-forget
  if (group.calendar_event_id) {
    addAttendeeToEvent({
      calendarEventId: group.calendar_event_id,
      email: student.email,
      displayName: student.name,
    }).catch((err: unknown) => console.error('Calendar add failed', err))
  }

  sendFullGroupApprovalEmail({
    studentEmail: student.email,
    studentName: student.name,
    requestedGroupTitle: group.title,
    requestedGroupFormatted: formatInTimeZone(
      new Date(group.start_time_utc),
      group.original_timezone,
      'MMM d, yyyy h:mm a zzz'
    ),
    facilitatorName: group.users?.name ?? '',
  }).catch((err: unknown) => console.error('Approval email failed', err))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[groupId]/signups/route.ts
git commit -m "feat: POST /api/groups/[groupId]/signups — add student with calendar + email"
```

---

### Task 3: DELETE /api/groups/[groupId]/signups/[signupId] (remove student)

**Files:**
- Create: `app/api/groups/[groupId]/signups/[signupId]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/groups/[groupId]/signups/[signupId]/route.ts
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { removeAttendeeFromEvent } from '@/lib/calendar'

async function recalculateStatus(groupId: string) {
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('capacity, status')
    .eq('id', groupId)
    .single()

  if (!group || group.status === 'draft' || group.status === 'canceled') return

  const { count } = await adminClient
    .from('signups')
    .select('id', { count: 'exact', head: true })
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const newStatus = confirmed >= group.capacity ? 'full' : 'published'
  await adminClient.from('group_sessions').update({ status: newStatus }).eq('id', groupId)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string; signupId: string }> }
) {
  const { groupId, signupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Validate signup belongs to this group
  const { data: signup } = await adminClient
    .from('signups')
    .select('id, student_id, group_session_id, users!student_id(email, name)')
    .eq('id', signupId)
    .eq('group_session_id', groupId)
    .maybeSingle()

  if (!signup) return NextResponse.json({ error: 'Signup not found' }, { status: 404 })

  await adminClient.from('signups').update({ status: 'canceled' }).eq('id', signupId)
  await recalculateStatus(groupId)

  // Calendar fire-and-forget
  const { data: group } = await adminClient
    .from('group_sessions')
    .select('calendar_event_id')
    .eq('id', groupId)
    .single()

  if (group?.calendar_event_id && signup.users?.email) {
    removeAttendeeFromEvent({
      calendarEventId: group.calendar_event_id,
      email: signup.users.email,
    }).catch((err: unknown) => console.error('Calendar remove failed', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/groups/[groupId]/signups/[signupId]/route.ts"
git commit -m "feat: DELETE /api/groups/[groupId]/signups/[signupId] — remove student"
```

---

### Task 4: GroupEditor client component

**Files:**
- Create: `app/admin/rounds/[roundId]/GroupEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/admin/rounds/[roundId]/GroupEditor.tsx
'use client'

import { useState, useEffect } from 'react'

interface Student {
  id: string
  name: string
  email: string
}

interface Signup {
  id: string
  student: Student
}

interface Group {
  id: string
  capacity: number
  status: string
  calendar_event_id: string | null
}

export default function GroupEditor({ group, allStudents }: {
  group: Group
  allStudents: Student[]
}) {
  const [capacity, setCapacity] = useState(group.capacity)
  const [signups, setSignups] = useState<Signup[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capacityLoading, setCapacityLoading] = useState(false)

  useEffect(() => {
    fetchSignups()
  }, [])

  async function fetchSignups() {
    const res = await fetch(`/api/groups/${group.id}/signups`)
    const data = await res.json()
    setSignups(data.signups ?? [])
  }

  async function saveCapacity() {
    setCapacityLoading(true)
    setError(null)
    const res = await fetch(`/api/groups/${group.id}/capacity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Failed to update capacity')
    setCapacityLoading(false)
  }

  async function addStudent() {
    if (!selectedStudentId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/groups/${group.id}/signups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: selectedStudentId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to add student')
    } else {
      setSelectedStudentId('')
      setSearch('')
      await fetchSignups()
    }
    setLoading(false)
  }

  async function removeStudent(signupId: string) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/groups/${group.id}/signups/${signupId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to remove student')
    } else {
      await fetchSignups()
    }
    setLoading(false)
  }

  const enrolledIds = new Set(signups.map(s => s.student.id))
  const availableStudents = allStudents.filter(s =>
    !enrolledIds.has(s.id) &&
    (search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="border-t bg-gray-50 px-4 py-4 space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Capacity */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Capacity</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={signups.length}
            max={20}
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm w-20"
          />
          <button
            onClick={saveCapacity}
            disabled={capacityLoading}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {capacityLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Members */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Members ({signups.length})</h4>
        {signups.length === 0 && <p className="text-sm text-gray-400 mb-3">No members yet.</p>}
        <ul className="space-y-1 mb-4">
          {signups.map(s => (
            <li key={s.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
              <span>{s.student.name} <span className="text-gray-400">({s.student.email})</span></span>
              <button
                onClick={() => removeStudent(s.id)}
                disabled={loading}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {/* Add student */}
        <h4 className="text-sm font-medium text-gray-700 mb-2">Add student</h4>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedStudentId('') }}
              className="border rounded px-2 py-1 text-sm w-full mb-1"
            />
            {search && availableStudents.length > 0 && (
              <ul className="border rounded bg-white shadow-sm max-h-40 overflow-y-auto">
                {availableStudents.slice(0, 10).map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setSelectedStudentId(s.id); setSearch(s.name) }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      {s.name} <span className="text-gray-400">({s.email})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={addStudent}
            disabled={!selectedStudentId || loading}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 self-start"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/rounds/[roundId]/GroupEditor.tsx
git commit -m "feat: GroupEditor inline expand component"
```

---

### Task 5: GET /api/groups/[groupId]/signups (fetch members for editor)

The GroupEditor calls `GET /api/groups/[groupId]/signups` to load current members. Add this to the existing signups route file.

**Files:**
- Modify: `app/api/groups/[groupId]/signups/route.ts`

- [ ] **Step 1: Add GET handler to the signups route**

Add this above the existing `POST` export:

```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: signups } = await adminClient
    .from('signups')
    .select('id, users!student_id(id, name, email)')
    .eq('group_session_id', groupId)
    .eq('status', 'confirmed')
    .order('created_at')

  const mapped = (signups ?? []).map((s: any) => ({
    id: s.id,
    student: { id: s.users.id, name: s.users.name, email: s.users.email },
  }))

  return NextResponse.json({ signups: mapped })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[groupId]/signups/route.ts
git commit -m "feat: GET /api/groups/[groupId]/signups — list members for editor"
```

---

### Task 6: Wire up the round detail page

Convert the page to a client component, add the Edit button per row, and render GroupEditor inline.

**Files:**
- Modify: `app/admin/rounds/[roundId]/page.tsx`

- [ ] **Step 1: Replace the page with the updated version**

The page needs to fetch all students (for the add dropdown) and pass them to GroupEditor. Because we need client state for the expanded group, we split into a server wrapper + client table component.

Replace `app/admin/rounds/[roundId]/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { cancelGroup } from './actions'
import GroupsTable from './GroupsTable'

export default async function RoundDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (!round) notFound()

  const { data: groups } = await supabase
    .from('group_sessions')
    .select('*, users!facilitator_id(name), signups(id, status)')
    .eq('round_id', roundId)
    .order('start_time_utc')

  const { data: allStudents } = await adminClient
    .from('users')
    .select('id, name, email')
    .eq('role', 'student')
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{round.title} — Groups</h1>
        <Link href={`/admin/rounds/${roundId}/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Add Groups
        </Link>
      </div>
      <GroupsTable
        groups={(groups ?? []).filter((g: any) => g.status !== 'canceled')}
        roundId={roundId}
        allStudents={allStudents ?? []}
        cancelGroup={cancelGroup}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/rounds/[roundId]/GroupsTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import GroupEditor from './GroupEditor'

interface Student {
  id: string
  name: string
  email: string
}

interface Group {
  id: string
  capacity: number
  status: string
  start_time_utc: string
  original_timezone: string
  calendar_event_id: string | null
  users: { name: string } | null
  signups: { id: string; status: string }[]
}

export default function GroupsTable({
  groups,
  roundId,
  allStudents,
  cancelGroup,
}: {
  groups: Group[]
  roundId: string
  allStudents: Student[]
  cancelGroup: (groupId: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-lg shadow">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="text-left p-4 font-medium text-gray-600">Facilitator</th>
            <th className="text-left p-4 font-medium text-gray-600">Date / Time</th>
            <th className="text-left p-4 font-medium text-gray-600">Capacity</th>
            <th className="text-left p-4 font-medium text-gray-600">Signups</th>
            <th className="text-left p-4 font-medium text-gray-600">Status</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const confirmed = group.signups.filter(s => s.status === 'confirmed').length
            const isExpanded = expandedId === group.id
            return (
              <>
                <tr key={group.id} className="border-b">
                  <td className="p-4">{group.users?.name}</td>
                  <td className="p-4">
                    {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                  </td>
                  <td className="p-4">{group.capacity}</td>
                  <td className="p-4">{confirmed} / {group.capacity}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      group.status === 'published' ? 'bg-green-100 text-green-700' :
                      group.status === 'full' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-3 items-center">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : group.id)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? 'Done' : 'Edit'}
                    </button>
                    <form action={cancelGroup.bind(null, group.id)}>
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700">Remove group</button>
                    </form>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${group.id}-editor`}>
                    <td colSpan={6} className="p-0">
                      <GroupEditor group={group} allStudents={allStudents} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
          {groups.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-gray-400 text-center">No groups yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Build and verify no TypeScript errors**

```bash
npm run build
```

Expected: clean build, no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/rounds/[roundId]/page.tsx app/admin/rounds/[roundId]/GroupsTable.tsx
git commit -m "feat: wire up inline group editor on round detail page"
```

---

### Task 7: End-to-end test and push

- [ ] **Step 1: Manual test — edit capacity**
  1. Go to `/admin/rounds/[roundId]`
  2. Click Edit on a group
  3. Change capacity and click Save
  4. Verify capacity updates in the table after collapsing and re-expanding

- [ ] **Step 2: Manual test — add student**
  1. In the expanded editor, search for a student by name
  2. Select them and click Add
  3. Verify they appear in the members list
  4. Verify a confirmation email was sent (check Resend logs or inbox)
  5. Verify they were added to the Google Calendar event

- [ ] **Step 3: Manual test — remove student**
  1. Click Remove next to a member
  2. Verify they disappear from the list
  3. Verify group status recalculates (if was full, should go to published)

- [ ] **Step 4: Push**

```bash
git push
```
