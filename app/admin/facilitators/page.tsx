import { createClient } from '@/lib/supabase/server'
import { createFacilitator, deleteFacilitator, updateFacilitatorZoomLink } from './actions'
import SeedFacilitators from './SeedFacilitators'

export default async function FacilitatorsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: facilitators } = await supabase
    .from('users')
    .select('*')
    .in('role', ['facilitator', 'admin'])
    .order('name')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Facilitators</h1>
      <SeedFacilitators existingCount={facilitators?.length ?? 0} />
      <div className="card mb-6">
        <h2 className="font-medium text-slate-900 mb-3">Add Facilitator</h2>
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        <form action={createFacilitator} className="flex gap-3 flex-wrap">
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
              <th className="text-left p-4 font-medium text-slate-500 w-40">Name</th>
              <th className="text-left p-4 font-medium text-slate-500 w-56">Email</th>
              <th className="text-left p-4 font-medium text-slate-500">Zoom Link</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {(facilitators ?? []).map((f: any) => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0">
                <td className="p-4 whitespace-nowrap text-slate-900">{f.name}</td>
                <td className="p-4 text-slate-500">{f.email}</td>
                <td className="p-4">
                  <form action={async (formData: FormData) => {
                    'use server'
                    await updateFacilitatorZoomLink(f.id, formData.get('zoom_link') as string)
                  }} className="flex gap-2">
                    <input name="zoom_link" defaultValue={f.zoom_link ?? ''}
                      placeholder="https://zoom.us/j/..."
                      className="input py-1 text-sm w-64 text-slate-600" />
                    <button type="submit" className="text-xs text-brand-600 hover:underline whitespace-nowrap">Save</button>
                  </form>
                </td>
                <td className="p-4">
                  <form action={deleteFacilitator.bind(null, f.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600 transition-colors">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {(facilitators ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-4 text-slate-400 text-center">No facilitators yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
