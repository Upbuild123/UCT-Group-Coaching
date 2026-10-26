import { requireAdmin } from '@/lib/auth'
import { runSystemChecks } from '@/lib/system-check'
import { addMissingZoomLinks, sendTestEmails } from './actions'
import SubmitButton from './SubmitButton'

export const dynamic = 'force-dynamic'

export default async function SystemCheckPage({ searchParams }: { searchParams: Promise<{ test?: string; to?: string; zoom?: string; fixed?: string; errors?: string }> }) {
  const { test, to, zoom, fixed, errors } = await searchParams
  await requireAdmin()
  const results = await runSystemChecks()
  const allOk = results.every(r => r.ok)

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">System check</h1>
      <p className="text-sm text-slate-600 mb-6">
        Tests the outside services with the live keys. Nothing is sent or created. Reload the page to check again.
      </p>

      <div className={`rounded-lg p-3 mb-6 text-sm ring-1 ${allOk ? 'bg-emerald-50 ring-emerald-200 text-emerald-800' : 'bg-rose-50 ring-rose-200 text-rose-800'}`}>
        {allOk ? 'Everything is working.' : 'Something needs attention. See the items marked below.'}
      </div>

      {zoom === 'done' && (
        <div className={`rounded-lg p-3 mb-6 text-sm ring-1 ${errors ? 'bg-amber-50 ring-amber-200 text-amber-800' : 'bg-emerald-50 ring-emerald-200 text-emerald-800'}`}>
          <p>Added Zoom links to {fixed ?? 0} invite{fixed === '1' ? '' : 's'}.</p>
          {errors && <p className="mt-1 whitespace-pre-line break-words">Could not update:{'\n'}{errors}</p>}
        </div>
      )}

      <div className="space-y-3">
        {results.map(r => (
          <div key={r.name} className="card flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {r.ok ? '✓' : '!'}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500 mb-1">{r.usedFor}</p>
              <p className={`text-sm break-words ${r.ok ? 'text-slate-600' : 'text-rose-700'}`}>{r.detail}</p>
              {r.name === 'Zoom links on invites' && !r.ok && r.detail.startsWith('Missing') && (
                <form action={addMissingZoomLinks} className="mt-3">
                  <SubmitButton label="Add Zoom links to invites" pendingLabel="Adding Zoom links..." className="btn-primary text-xs px-3 py-1.5" />
                  <p className="text-xs text-slate-500 mt-1">Updates the invites quietly; no emails are sent.</p>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <p className="font-semibold text-slate-900">Test emails</p>
        <p className="text-sm text-slate-600 mb-3">
          Sends you a sample of the reminder students get the day before a session, and the attendance email facilitators get afterwards.
        </p>
        {test === 'sent' && <p className="text-sm text-emerald-700 mb-3">Sent to {to}. Check your inbox (and spam).</p>}
        {test === 'failed' && <p className="text-sm text-rose-700 mb-3">Sending failed. Check the Resend row above.</p>}
        <form action={sendTestEmails}>
          <SubmitButton label="Send me test emails" pendingLabel="Sending..." className="btn-secondary text-sm" />
        </form>
      </div>
    </div>
  )
}
