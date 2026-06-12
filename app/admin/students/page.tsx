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

function StudentsContent() {
  const error = useSearchParams().get('error')
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    fetch('/api/users?role=student')
      .then(r => r.json())
      .then(d => setStudents(d.users ?? []))
  }, [error])

  return (
    <div className="max-w-2xl">
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
      <div className="card p-0 overflow-hidden">
        <table className="text-sm w-full">
          <thead className="border-b border-slate-100">
            <tr>
              <th className="text-left p-4 font-medium text-slate-500 w-48">Name</th>
              <th className="text-left p-4 font-medium text-slate-500 w-64">Email</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b border-slate-100 last:border-0">
                <td className="p-4 whitespace-nowrap text-slate-900">{student.name}</td>
                <td className="p-4 text-slate-500">{student.email}</td>
                <td className="p-4">
                  <form action={deleteStudent.bind(null, student.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600 transition-colors">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-slate-400 text-center">No students yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
