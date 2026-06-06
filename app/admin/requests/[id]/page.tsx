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
      <h1 className="text-2xl font-bold mb-6">Full Group Request</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Student</p>
          <p className="font-medium">{student.name}</p>
          <p className="text-sm text-gray-500">{student.email}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Requested Group</p>
          <p className="font-medium">{requestedGroup.title}</p>
          <p className="text-sm text-gray-500">{requestedFormatted}</p>
          <p className="text-sm text-gray-500">Facilitator: {requestedFacilitator?.name}</p>
          <p className="text-sm text-gray-500">Roster: {requestedCount}/{requestedGroup.capacity}</p>
        </div>

        {currentGroup ? (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Group</p>
            <p className="font-medium">{currentGroup.title}</p>
            <p className="text-sm text-gray-500">{currentFormatted}</p>
            <p className="text-sm text-gray-500">Facilitator: {currentFacilitator?.name}</p>
            <p className="text-sm text-gray-500">Roster: {currentCount}/{currentGroup.capacity}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Group</p>
            <p className="text-sm text-gray-500">None — student has no current group in this round</p>
          </div>
        )}

        {fgr.reason && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Student's Reason</p>
            <p className="text-sm">{fgr.reason}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className="text-sm font-medium capitalize">{fgr.status}</p>
        </div>
      </div>

      {alreadyResolved ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-700">
          This request has already been {fgr.status}.
        </div>
      ) : (
        <form method="POST" action={`/admin/requests/${id}/decide`} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <p className="font-medium mb-2">Decision</p>
            <label className="flex items-center gap-2 mb-2">
              <input type="radio" name="decision" value="approved" required /> Approve
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="decision" value="rejected" required /> Reject
            </label>
          </div>

          {currentGroup && (
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="keepCurrentSlot" value="true" />
                Keep student in their current group (treat new group as additional signup)
              </label>
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Submit Decision
          </button>
        </form>
      )}
    </div>
  )
}
