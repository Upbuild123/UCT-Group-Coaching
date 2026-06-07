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
    if (!res.ok) {
      setError('Failed to fetch signups')
      return
    }
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
            onChange={e => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val)) setCapacity(val)
            }}
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
