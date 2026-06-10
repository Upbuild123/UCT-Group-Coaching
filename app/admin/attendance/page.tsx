import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'

export default async function AttendancePage() {
  const supabase = await createClient()

  const { data: signups } = await supabase
    .from('signups')
    .select(`
      status,
      users!student_id(id, name, email),
      group_sessions(title, start_time_utc, original_timezone, status, rounds(title))
    `)
    .in('status', ['confirmed', 'no_show'])

  const now = Date.now()

  const byStudent = new Map<string, {
    name: string
    email: string
    sessions: { title: string; roundTitle: string; when: string; attended: boolean }[]
  }>()

  for (const signup of signups ?? []) {
    const group = signup.group_sessions as any
    const student = signup.users as any
    if (!group || !student) continue
    if (group.status === 'canceled') continue
    if (new Date(group.start_time_utc).getTime() > now) continue

    if (!byStudent.has(student.id)) {
      byStudent.set(student.id, { name: student.name, email: student.email, sessions: [] })
    }

    byStudent.get(student.id)!.sessions.push({
      title: group.title,
      roundTitle: group.rounds?.title ?? '',
      when: formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz'),
      attended: signup.status === 'confirmed',
    })
  }

  const rows = Array.from(byStudent.values())
    .map(s => ({
      ...s,
      attendedCount: s.sessions.filter(x => x.attended).length,
      missedCount: s.sessions.filter(x => !x.attended).length,
      sessions: s.sessions.sort((a, b) => a.when.localeCompare(b.when)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Attendance</h1>
      <div className="bg-white rounded-lg shadow divide-y">
        {rows.map(row => (
          <details key={row.email} className="p-4">
            <summary className="cursor-pointer flex items-center justify-between">
              <div>
                <span className="font-medium">{row.name}</span>
                <span className="text-gray-400 text-sm ml-2">{row.email}</span>
              </div>
              <div className="text-sm text-gray-600 flex gap-3">
                <span className="text-green-700">{row.attendedCount} attended</span>
                <span className="text-red-600">{row.missedCount} missed</span>
              </div>
            </summary>
            <ul className="mt-3 space-y-1 text-sm">
              {row.sessions.map((s, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{s.roundTitle} — {s.title} — {s.when}</span>
                  <span className={s.attended ? 'text-green-700' : 'text-red-600'}>
                    {s.attended ? 'Attended' : 'Missed'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {rows.length === 0 && (
          <p className="p-4 text-gray-400 text-center">No completed sessions yet.</p>
        )}
      </div>
    </div>
  )
}
