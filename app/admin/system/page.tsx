import { requireAdmin } from '@/lib/auth'
import { runSystemChecks } from '@/lib/system-check'

export const dynamic = 'force-dynamic'

export default async function SystemCheckPage() {
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
