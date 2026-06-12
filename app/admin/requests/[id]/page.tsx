import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'

export default async function AdminRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await adminClient.from('users').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') redirect('/login')

  const { data: fgr } = await adminClient
    .from('full_group_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!fgr) redirect('/admin/dashboard')

  const [studentRes, requestedGroupRes, currentGroupRes] = await Promise.all([
    adminClient.from('users').select('name, email').eq('id', fgr.student_id).single(),
    adminClient
      .from('group_sessions')
      .select('id, title, start_time_utc, original_timezone, capacity, users!facilitator_id(name), signups(id, status)')
      .eq('id', fgr.requested_group_session_id)
      .single(),
    fgr.current_group_session_id
      ? adminClient
          .from('group_sessions')
          .select('id, title, start_time_utc, original_timezone, capacity, users!facilitator_id(name), signups(id, status)')
          .eq('id', fgr.current_group_session_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const student = studentRes.data
  const requestedGroup = requestedGroupRes.data
  if (!student || !requestedGroup) redirect('/admin/dashboard')
  const currentGroup = currentGroupRes.data
  const requestedFacilitator = (requestedGroup as any).users
  const currentFacilitator = currentGroup ? (currentGroup as any).users : null

  const requestedCount = (requestedGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length
  const currentCount = currentGroup ? (currentGroup.signups ?? []).filter((s: any) => s.status === 'confirmed').length : 0

  const requestedFormatted = formatInTimeZone(new Date(requestedGroup.start_time_utc), requestedGroup.original_timezone, 'MMMM d, yyyy h:mm a zzz')
  const currentFormatted = currentGroup ? formatInTimeZone(new Date(currentGroup.start_time_utc), currentGroup.original_timezone, 'MMMM d, yyyy h:mm a zzz') : null

  const alreadyResolved = fgr.status !== 'pending'

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Full Group Request</h1>

      <div className="card mb-6 space-y-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Student</p>
          <p className="font-medium text-slate-900">{student.name}</p>
          <p className="text-sm text-slate-500">{student.email}</p>
        </div>

        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Requested Group</p>
          <p className="font-medium text-slate-900">{requestedGroup.title}</p>
          <p className="text-sm text-slate-500">{requestedFormatted}</p>
          <p className="text-sm text-slate-500">Facilitator: {requestedFacilitator?.name}</p>
          <p className="text-sm text-slate-500">Roster: {requestedCount}/{requestedGroup.capacity}</p>
        </div>

        {currentGroup ? (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Current Group</p>
            <p className="font-medium text-slate-900">{currentGroup.title}</p>
            <p className="text-sm text-slate-500">{currentFormatted}</p>
            <p className="text-sm text-slate-500">Facilitator: {currentFacilitator?.name}</p>
            <p className="text-sm text-slate-500">Roster: {currentCount}/{currentGroup.capacity}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Current Group</p>
            <p className="text-sm text-slate-500">None — student has no current group in this round</p>
          </div>
        )}

        {fgr.reason && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Student's Reason</p>
            <p className="text-sm text-slate-700">{fgr.reason}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
          <p className="text-sm font-medium text-slate-900 capitalize">{fgr.status}</p>
        </div>
      </div>

      {alreadyResolved ? (
        <div className="rounded-lg p-4 text-sm bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          This request has already been {fgr.status}.
        </div>
      ) : (
        <form method="POST" action={`/admin/requests/${id}/decide`} className="card space-y-4">
          <div>
            <p className="font-medium text-slate-900 mb-2">Decision</p>
            <label className="flex items-center gap-2 mb-2 text-sm text-slate-700">
              <input type="radio" name="decision" value="approved" required /> Approve
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="decision" value="rejected" required /> Reject
            </label>
          </div>

          {currentGroup && (
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="keepCurrentSlot" value="true" />
                Keep student in their current group (treat new group as additional signup)
              </label>
            </div>
          )}

          <button type="submit" className="btn-primary text-sm">
            Submit Decision
          </button>
        </form>
      )}
    </div>
  )
}
