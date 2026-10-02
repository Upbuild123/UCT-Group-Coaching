export type Role = 'admin' | 'facilitator' | 'student'
export type SignupStatus = 'closed' | 'open' | 'extra_signups_open'
export type GroupStatus = 'draft' | 'published' | 'full' | 'canceled'
export type SignupStatusType = 'confirmed' | 'canceled' | 'moved'
export type SignupType = 'primary' | 'additional' | 'admin_override'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled'
export type FacilitatorDecision = 'approved' | 'rejected' | null

// Students can hold at most this many sessions in one round, even with extra signups open
// (also enforced by the signups trigger in supabase/migrations/011_signup_capacity_guard.sql)
export const MAX_SIGNUPS_PER_ROUND = 2

export interface User {
  id: string
  name: string
  email: string
  role: Role
  timezone: string
  created_at: string
}

export interface Round {
  id: string
  round_number: number
  title: string
  signup_status: SignupStatus
  created_at: string
}

export interface GroupSession {
  id: string
  round_id: string
  facilitator_id: string
  title: string
  notes: string | null
  start_time_utc: string
  end_time_utc: string
  original_timezone: string
  capacity: number
  status: GroupStatus
  calendar_event_id: string | null
  created_at: string
}

export interface Signup {
  id: string
  student_id: string
  group_session_id: string
  round_id: string
  status: SignupStatusType
  signup_type: SignupType
  created_at: string
}

export interface FullGroupRequest {
  id: string
  student_id: string
  round_id: string
  current_group_session_id: string | null
  requested_group_session_id: string
  reason: string | null
  status: RequestStatus
  decided_by_user_id: string | null
  decided_at: string | null
  new_facilitator_decision: FacilitatorDecision
  old_facilitator_decision: FacilitatorDecision
  created_at: string
}
