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
}: {
  groups: Group[]
  roundId: string
  allStudents: Student[]
  cancelGroup: (groupId: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-lg shadow">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="text-left p-4 font-medium text-gray-600">Facilitator</th>
            <th className="text-left p-4 font-medium text-gray-600">Date / Time</th>
            <th className="text-left p-4 font-medium text-gray-600">Capacity</th>
            <th className="text-left p-4 font-medium text-gray-600">Signups</th>
            <th className="text-left p-4 font-medium text-gray-600">Status</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const confirmed = group.signups.filter(s => s.status === 'confirmed').length
            const isExpanded = expandedId === group.id
            return (
              <React.Fragment key={group.id}>
                <tr className="border-b">
                  <td className="p-4">{group.users?.name}</td>
                  <td className="p-4">
                    {formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz')}
                  </td>
                  <td className="p-4">{group.capacity}</td>
                  <td className="p-4">{confirmed} / {group.capacity}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      group.status === 'published' ? 'bg-green-100 text-green-700' :
                      group.status === 'full' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3 items-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : group.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {isExpanded ? 'Done' : 'Edit'}
                      </button>
                      <form action={cancelGroup.bind(null, group.id)}>
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700">Remove group</button>
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
            <tr><td colSpan={6} className="p-4 text-gray-400 text-center">No groups yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
