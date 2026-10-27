'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createStudent, deleteStudent } from './actions'
import BulkImport from './BulkImport'
import { useEffect, useState } from 'react'

interface Student {
  id: string
  name: string
  email: string
}

interface StudentSessions {
  total: number
  rounds: number[]
}

const ROUNDS = [1, 2, 3, 4]

function StudentsContent() {
  const error = useSearchParams().get('error')
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<Record<string, StudentSessions>>({})

  useEffect(() => {
    fetch('/api/users?role=student')
      .then(r => r.json())
      .then(d => setStudents(d.users ?? []))
    fetch('/api/admin/student-sessions')
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? {}))
  }, [error])

  const fullyBooked = students.filter(s => (sessions[s.id]?.rounds.length ?? 0) === ROUNDS.length).length

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Students</h1>
      <BulkImport />
      <div className="card mb-6">
        <h2 className="font-medium text-slate-900 mb-3">Add Student</h2>
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        <form action={createStudent} className="flex gap-3 flex-wrap">
          <input name="name" placeholder="Full name" required
            className="input w-48" />
          <input name="email" type="email" placeholder="Email" required
            className="input w-64" />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
      </div>
      {students.length > 0 && (
        <p className="text-sm text-slate-600 mb-3">
          {fullyBooked} of {students.length} students are signed up for all {ROUNDS.length} rounds.
        </p>
      )}
      <div className="card p-0 overflow-x-auto">
        <table className="text-sm w-full">
          <thead className="border-b border-slate-100">
            <tr>
              <th className="text-left p-4 font-medium text-slate-500 w-48">Name</th>
              <th className="text-left p-4 font-medium text-slate-500 w-64">Email</th>
              <th className="text-left p-4 font-medium text-slate-500">Sessions</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b border-slate-100 last:border-0">
                <td className="p-4 whitespace-nowrap text-slate-900">{student.name}</td>
                <td className="p-4 text-slate-500">{student.email}</td>
                <td className="p-4 whitespace-nowrap">
                  <SessionSummary sessions={sessions[student.id]} />
                </td>
                <td className="p-4">
                  <form action={deleteStudent.bind(null, student.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600 transition-colors">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-slate-400 text-center">No students yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SessionSummary({ sessions }: { sessions?: StudentSessions }) {
  const total = sessions?.total ?? 0
  const rounds = sessions?.rounds ?? []
  const missing = ROUNDS.filter(r => !rounds.includes(r))
  const complete = missing.length === 0

  return (
    <div className="flex items-center gap-2" title={missing.length ? `Not signed up for Round ${missing.join(', ')}` : 'Signed up for every round'}>
      <span className={`font-semibold ${complete ? 'text-emerald-700' : total === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{total}</span>
      <span className="flex gap-1">
        {ROUNDS.map(r => (
          <span
            key={r}
            className={`text-xs px-1.5 py-0.5 rounded ${rounds.includes(r) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}
          >
            R{r}
          </span>
        ))}
      </span>
    </div>
  )
}

export default function StudentsPage() {
  return (
    <Suspense>
      <StudentsContent />
    </Suspense>
  )
}
