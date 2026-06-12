'use client'

import React, { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import GroupEditor from './GroupEditor'

interface Student {
  id: string
  name: string
  email: string
}

interface Group {
  id: string
  capacity: number
  status: string
  start_time_utc: string
  original_timezone: string
  calendar_event_id: string | null
  users: { name: string } | null
  signups: { id: string; status: string }[]
}

export default function GroupsTable({
  groups,
  roundId,
  allStudents,
  cancelGroup,
  publishGroup,
}: {
  groups: Group[]
  roundId: string
  allStudents: Student[]
  cancelGroup: (groupId: string) => Promise<void>
  publishGroup: (groupId: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100">
          <tr>
            <th className="text-left p-4 font-medium text-slate-500">Facilitator</th>
            <th className="text-left p-4 font-medium text-slate-500">Date / Time</th>
            <th className="text-left p-4 font-medium text-slate-500">Capacity</th>
            <th className="text-left p-4 font-medium text-slate-500">Signups</th>
            <th className="text-left p-4 font-medium text-slate-500">Status</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const confirmed = group.signups.filter(s => s.status === 'confirmed').length
            const isExpanded = expandedId === group.id
            return (
              <React.Fragment key={group.id}>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-900">{group.users?.name}</td>
                  <td className="p-4 text-slate-600">
                    {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                  </td>
                  <td className="p-4 text-slate-600">{group.capacity}</td>
                  <td className="p-4 text-slate-600">{confirmed} / {group.capacity}</td>
                  <td className="p-4">
                    <span className={
                      group.status === 'published' ? 'badge-green' :
                      group.status === 'full' ? 'badge-brand' :
                      'badge-gray'
                    }>
                      {group.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3 items-center">
                      {group.status === 'draft' && (
                        <form action={publishGroup.bind(null, group.id)}>
                          <button type="submit" className="text-xs text-emerald-600 hover:text-emerald-700">Publish</button>
                        </form>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : group.id)}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        {isExpanded ? 'Done' : 'Edit'}
                      </button>
                      <form action={cancelGroup.bind(null, group.id)} onSubmit={() => setCancelingId(group.id)}>
                        <button
                          type="submit"
                          disabled={cancelingId === group.id}
                          className="text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50 transition-colors"
                        >
                          {cancelingId === group.id ? 'Removing...' : 'Remove group'}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${group.id}-editor`}>
                    <td colSpan={6} className="p-0">
                      <GroupEditor group={group} allStudents={allStudents} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
          {groups.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-slate-400 text-center">No groups yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
