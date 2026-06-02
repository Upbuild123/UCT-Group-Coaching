import { createClient } from '@/lib/supabase/server'
import { createFacilitator, deleteFacilitator, updateFacilitatorZoomLink } from './actions'
import SeedFacilitators from './SeedFacilitators'

export default async function FacilitatorsPage() {
  const supabase = await createClient()
  const { data: facilitators } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'facilitator')
    .order('name')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Facilitators</h1>
      <SeedFacilitators existingCount={facilitators?.length ?? 0} />
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <h2 className="font-medium mb-3">Add Facilitator</h2>
        <form action={createFacilitator} className="flex gap-3 flex-wrap">
          <input name="name" placeholder="Full name" required
            className="border rounded px-3 py-2 text-sm w-48" />
          <input name="email" type="email" placeholder="Email" required
            className="border rounded px-3 py-2 text-sm w-64" />
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Add
          </button>
        </form>
      </div>
      <div className="bg-white rounded-lg shadow">
        <table className="text-sm w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600 w-40">Name</th>
              <th className="text-left p-4 font-medium text-gray-600 w-56">Email</th>
              <th className="text-left p-4 font-medium text-gray-600">Zoom Link</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {(facilitators ?? []).map((f: any) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="p-4 whitespace-nowrap">{f.name}</td>
                <td className="p-4 text-gray-600">{f.email}</td>
                <td className="p-4">
                  <form action={async (formData: FormData) => {
                    'use server'
                    await updateFacilitatorZoomLink(f.id, formData.get('zoom_link') as string)
                  }} className="flex gap-2">
                    <input name="zoom_link" defaultValue={f.zoom_link ?? ''}
                      placeholder="https://zoom.us/j/..."
                      className="border rounded px-2 py-1 text-sm w-64 text-gray-600" />
                    <button type="submit" className="text-xs text-blue-600 hover:underline whitespace-nowrap">Save</button>
                  </form>
                </td>
                <td className="p-4">
                  <form action={deleteFacilitator.bind(null, f.id)}>
                    <button type="submit" className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {(facilitators ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-4 text-gray-400 text-center">No facilitators yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
