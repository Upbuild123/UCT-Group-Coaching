'use client'

import { useState } from 'react'
import { bulkImportFacilitators } from './actions'

const DEFAULTS = [
  { name: 'Vipin Goyal', email: 'vipin@upbuild.com', zoom_link: '' },
  { name: 'Gina Kellogg', email: 'gina@upbuild.com', zoom_link: '' },
  { name: 'Mary Kuentz', email: 'mary@upbuild.com', zoom_link: '' },
  { name: 'Melissa Arthur', email: 'melissa@upbuild.com', zoom_link: '' },
]

export default function SeedFacilitators({ existingCount }: { existingCount: number }) {
  const [entries, setEntries] = useState(DEFAULTS.map(d => ({ ...d })))
  const [open, setOpen] = useState(existingCount === 0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ imported: number; errors: string[] } | null>(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-brand-600 hover:underline mb-4 block">
        + Add default facilitators
      </button>
    )
  }

  function update(i: number, field: 'name' | 'email' | 'zoom_link', value: string) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function addRow() {
    setEntries(prev => [...prev, { name: '', email: '', zoom_link: '' }])
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
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">Add Facilitators</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Edit details as needed, then click Import. Michael Sloyer is already set up as admin/facilitator.</p>
      <div className="border border-slate-200 rounded-lg mb-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Name</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Email</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Zoom Link</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5">
                  <input value={e.name} onChange={ev => update(i, 'name', ev.target.value)}
                    className="input py-1" />
                </td>
                <td className="px-3 py-1.5">
                  <input value={e.email} onChange={ev => update(i, 'email', ev.target.value)}
                    className="input py-1" />
                </td>
                <td className="px-3 py-1.5">
                  <input value={e.zoom_link} onChange={ev => update(i, 'zoom_link', ev.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="input py-1" />
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-rose-600 text-xs transition-colors">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={addRow} className="text-xs text-brand-600 hover:underline">+ Add row</button>
        <button onClick={handleImport} disabled={loading} className="btn-primary text-sm">
          {loading ? 'Importing...' : `Import ${entries.filter(e => e.name.trim() && e.email.includes('@')).length} facilitators`}
        </button>
      </div>
      {status && (
        <div className={`mt-3 text-sm rounded-lg p-3 ${status.errors.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
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
