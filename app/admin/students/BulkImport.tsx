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
    <div className="bg-white rounded-lg shadow mb-6 p-4">
      <h2 className="font-medium mb-1">Bulk Import Students</h2>
      <p className="text-xs text-gray-400 mb-3">Paste a list of names and emails — one per line, separated by a tab or spaces.</p>

      {step === 'paste' && (
        <>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setStatus(null) }}
            rows={6}
            placeholder={"Anna Knight\tanna.knight@example.com\nJay Gopal\tjay@example.com"}
            className="w-full border rounded px-3 py-2 text-sm font-mono mb-3"
          />
          <button
            onClick={handlePreview}
            disabled={!text.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Preview ({parseStudentText(text).length} students)
          </button>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="border rounded mb-3 max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-gray-600">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('paste')}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleImport} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Importing...' : `Import ${preview.length} students`}
            </button>
          </div>
        </>
      )}

      {status && (
        <div className={`mt-3 text-sm rounded p-3 ${status.errors.length === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-800'}`}>
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
