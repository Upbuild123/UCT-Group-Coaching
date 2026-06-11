import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*, group_sessions(id, status, capacity, signups(id, status))')
    .order('round_number')

  const stats = (rounds ?? []).map((round: any) => {
    const groups = round.group_sessions ?? []
    const totalSignups = groups.flatMap((g: any) => g.signups ?? [])
      .filter((s: any) => s.status === 'confirmed').length
    const openSeats = groups
      .filter((g: any) => g.status === 'published')
      .reduce((acc: number, g: any) => {
        const confirmed = (g.signups ?? []).filter((s: any) => s.status === 'confirmed').length
        return acc + Math.max(0, g.capacity - confirmed)
      }, 0)
    const activeGroups = groups.filter((g: any) => g.status !== 'canceled')
    return {
      round,
      publishedGroups: activeGroups.filter((g: any) => g.status === 'published' || g.status === 'full').length,
      draftGroups: activeGroups.filter((g: any) => g.status === 'draft').length,
      totalSignups,
      openSeats,
      fullGroups: groups.filter((g: any) => g.status === 'full').length,
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ round, publishedGroups, draftGroups, totalSignups, openSeats, fullGroups }) => (
          <div key={round.id} className="card">
            <h2 className="font-semibold text-lg text-slate-900 mb-3">{round.title}</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Published groups</dt><dd className="font-medium text-slate-900">{publishedGroups}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Draft groups</dt><dd className="font-medium text-slate-900">{draftGroups}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Signups</dt><dd className="font-medium text-slate-900">{totalSignups}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Open seats</dt><dd className="font-medium text-slate-900">{openSeats}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Full groups</dt><dd className="font-medium text-slate-900">{fullGroups}</dd></div>
            </dl>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className={
                round.signup_status === 'open' ? 'badge-green' :
                round.signup_status === 'extra_signups_open' ? 'badge-brand' :
                'badge-gray'
              }>
                {round.signup_status.replace(/_/g, ' ')}
              </span>
              <Link href={`/admin/rounds/${round.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">Manage →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
