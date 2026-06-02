'use client'

import { useState } from 'react'
import { bulkImportFacilitators } from './actions'

const DEFAULTS = [
  { name: 'Michael Sloyer', email: 'michael@upbuild.com' },
  { name: 'Vipin Goyal', email: 'vipin@upbuild.com' },
  { name: 'Gina Kellogg', email: 'gina@upbuild.com' },
  { name: 'Mary Kuentz', email: 'mary@upbuild.com' },
  { name: 'Melissa Arthur', email: 'melissa@upbuild.com' },
]

export default function SeedFacilitators({ existingCount }: { existingCount: number }) {
  const [entries, setEntries] = useState(DEFAULTS.map(d => ({ ...d })))
  const [open, setOpen] = useState(existingCount === 0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ imported: number; errors: string[] } | null>(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline mb-4 block">
        + Add default facilitators
      </button>
    )
  }

  function update(i: number, field: 'name' | 'email', value: string) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function addRow() {
    setEntries(prev => [...prev, { name: '', email: '' }])
  }

  function removeRow(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleImport() {
    const valid = entries.filter(e => e.name.trim() && e.email.includes('@'))
    setLoading(true)
    const result = await bulkImportFacilitators(valid)
    setStatus(result)
    setLoading(false)
    if (result.errors.length === 0) setOpen(false)
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Add Facilitators</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Edit names and emails as needed, then click Import.</p>
      <div className="border rounded mb-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <input value={e.name} onChange={ev => update(i, 'name', ev.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-1.5">
                  <input value={e.email} onChange={ev => update(i, 'email', ev.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={addRow} className="text-xs text-blue-600 hover:underline">+ Add row</button>
        <button onClick={handleImport} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Importing...' : `Import ${entries.filter(e => e.name.trim() && e.email.includes('@')).length} facilitators`}
        </button>
      </div>
      {status && (
        <div className={`mt-3 text-sm rounded p-3 ${status.errors.length === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-800'}`}>
          <p className="font-medium">Imported {status.imported} facilitator{status.imported !== 1 ? 's' : ''}.</p>
          {status.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside space-y-1">
              {status.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
