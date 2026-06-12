'use client'

import { useState } from 'react'
import { bulkImportStudents } from './actions'

function parseStudentText(text: string): Array<{ name: string; email: string }> {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .flatMap(line => {
      // Split on tab or multiple spaces
      const parts = line.split(/\t|  +/)
      if (parts.length < 2) return []
      const name = parts[0].trim()
      const email = parts[parts.length - 1].trim()
      if (!name || !email.includes('@')) return []
      return [{ name, email }]
    })
}

export default function BulkImport() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Array<{ name: string; email: string }>>([])
  const [status, setStatus] = useState<{ imported: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'paste' | 'preview'>('paste')

  function handlePreview() {
    const parsed = parseStudentText(text)
    setPreview(parsed)
    setStep('preview')
  }

  async function handleImport() {
    setLoading(true)
    const result = await bulkImportStudents(preview)
    setStatus(result)
    setLoading(false)
    if (result.errors.length === 0) {
      setText('')
      setPreview([])
      setStep('paste')
    }
  }

  return (
    <div className="card mb-6">
      <h2 className="font-medium text-slate-900 mb-1">Bulk Import Students</h2>
      <p className="text-xs text-slate-400 mb-3">Paste a list of names and emails — one per line, separated by a tab or spaces.</p>

      {step === 'paste' && (
        <>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setStatus(null) }}
            rows={6}
            placeholder={"Anna Knight\tanna.knight@example.com\nJay Gopal\tjay@example.com"}
            className="input font-mono mb-3"
          />
          <button
            onClick={handlePreview}
            disabled={!text.trim()}
            className="btn-primary text-sm"
          >
            Preview ({parseStudentText(text).length} students)
          </button>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="border border-slate-200 rounded-lg mb-3 max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Email</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-900">{s.name}</td>
                    <td className="px-3 py-2 text-slate-500">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('paste')} className="btn-secondary text-sm">
              Back
            </button>
            <button onClick={handleImport} disabled={loading} className="btn-primary text-sm">
              {loading ? 'Importing...' : `Import ${preview.length} students`}
            </button>
          </div>
        </>
      )}

      {status && (
        <div className={`mt-3 text-sm rounded-lg p-3 ${status.errors.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          <p className="font-medium">Imported {status.imported} student{status.imported !== 1 ? 's' : ''}.</p>
          {status.errors.length > 0 && (
            <ul className="mt-1 list-disc list-inside space-y-1">
              {status.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
