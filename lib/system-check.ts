import 'server-only'
import { google } from 'googleapis'
import { adminClient } from '@/lib/supabase/admin'
import { getEventLocation } from '@/lib/calendar'

export interface CheckResult {
  name: string
  usedFor: string
  ok: boolean
  detail: string
}

// Read-only checks of the outside services the app depends on, using the deployed keys.
// Nothing here sends email, creates events, or spends meaningful API credit.

async function checkOpenAI(): Promise<CheckResult> {
  const base = { name: 'OpenAI', usedFor: 'Reading pasted session text when adding groups' }
  if (!process.env.OPENAI_API_KEY) return { ...base, ok: false, detail: 'OPENAI_API_KEY is not set' }
  const res = await fetch('https://api.openai.com/v1/models/gpt-4o-mini', {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  })
  if (res.ok) return { ...base, ok: true, detail: 'Key works' }
  const body = await res.json().catch(() => ({}))
  return { ...base, ok: false, detail: `${res.status}: ${body.error?.code ?? body.error?.message ?? 'request failed'}` }
}

async function checkResend(): Promise<CheckResult> {
  const base = { name: 'Resend', usedFor: 'All app emails (reminders, requests, no-show checks)' }
  if (!process.env.RESEND_API_KEY) return { ...base, ok: false, detail: 'RESEND_API_KEY is not set' }
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  const body = await res.json().catch(() => ({}))
  if (res.ok) {
    const domains = (body.data ?? []) as Array<{ name: string; status: string }>
    const upbuild = domains.find(d => d.name === 'upbuild.com')
    if (!upbuild) return { ...base, ok: false, detail: 'Key works, but upbuild.com is not a domain in this Resend account (emails are sent from noreply@upbuild.com)' }
    if (upbuild.status !== 'verified') return { ...base, ok: false, detail: `Key works, but upbuild.com is "${upbuild.status}", not verified` }
    return { ...base, ok: true, detail: 'Key works and upbuild.com is verified' }
  }
  // A sending-only key can't list domains, but being recognised as one means it is valid
  if (body.name === 'restricted_api_key') return { ...base, ok: true, detail: 'Key works (sending-only key, so the domain could not be checked)' }
  return { ...base, ok: false, detail: `${res.status}: ${body.message ?? body.name ?? 'request failed'}` }
}

async function checkGoogleCalendar(): Promise<CheckResult> {
  const base = { name: 'Google Calendar', usedFor: 'Creating and updating session invites' }
  const missing = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CALENDAR_ID'].filter(k => !process.env[k])
  if (missing.length) return { ...base, ok: false, detail: `Not set: ${missing.join(', ')}` }
  try {
    const jwt = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL,
    })
    const calendar = google.calendar({ version: 'v3', auth: jwt })
    const { data } = await calendar.calendars.get({ calendarId: process.env.GOOGLE_CALENDAR_ID! })
    return { ...base, ok: true, detail: `Can reach calendar "${data.summary}"` }
  } catch (err) {
    const e = err as { response?: { data?: { error?: string | { message?: string } } }; message?: string }
    const apiError = e.response?.data?.error
    const reason = typeof apiError === 'string' ? apiError : apiError?.message ?? e.message ?? 'request failed'
    return { ...base, ok: false, detail: reason }
  }
}

function checkSettings(): CheckResult {
  const required = ['NEXT_PUBLIC_APP_URL', 'CRON_SECRET', 'DECISION_TOKEN_SECRET']
  const missing = required.filter(k => !process.env[k])
  return {
    name: 'App settings',
    usedFor: 'Email links and the daily reminder / no-show jobs',
    ok: missing.length === 0,
    detail: missing.length ? `Not set: ${missing.join(', ')}` : `All set (${required.join(', ')})`,
  }
}

export interface InviteMissingZoom {
  groupId: string
  title: string
  calendarEventId: string
  zoomLink: string
}

// Upcoming sessions whose calendar invite doesn't carry the facilitator's current Zoom link
// (e.g. invites created before Zoom links were added to invites)
export async function findInvitesMissingZoom(): Promise<InviteMissingZoom[]> {
  const { data: groups } = await adminClient
    .from('group_sessions')
    .select('id, title, calendar_event_id, users!facilitator_id(zoom_link)')
    .in('status', ['published', 'full'])
    .not('calendar_event_id', 'is', null)
    .gte('start_time_utc', new Date().toISOString())

  const missing: InviteMissingZoom[] = []
  for (const g of groups ?? []) {
    const zoomLink = (g.users as unknown as { zoom_link: string | null } | null)?.zoom_link
    if (!zoomLink) continue
    const location = await getEventLocation(g.calendar_event_id!)
    if (location !== zoomLink) {
      missing.push({ groupId: g.id, title: g.title, calendarEventId: g.calendar_event_id!, zoomLink })
    }
  }
  return missing
}

async function checkInviteZoomLinks(): Promise<CheckResult> {
  const base = { name: 'Zoom links on invites', usedFor: 'Upcoming session invites show the facilitator\'s Zoom link' }
  const missing = await findInvitesMissingZoom()
  if (missing.length === 0) return { ...base, ok: true, detail: 'Every upcoming invite has its Zoom link' }
  return { ...base, ok: false, detail: `Missing on ${missing.length}: ${missing.map(m => m.title).join(', ')}` }
}

export async function runSystemChecks(): Promise<CheckResult[]> {
  const safely = (name: string, usedFor: string, check: () => Promise<CheckResult>) =>
    check().catch((err: unknown) => ({ name, usedFor, ok: false, detail: err instanceof Error ? err.message : 'check failed' }))

  return Promise.all([
    safely('OpenAI', 'Reading pasted session text when adding groups', checkOpenAI),
    safely('Resend', 'All app emails (reminders, requests, no-show checks)', checkResend),
    safely('Google Calendar', 'Creating and updating session invites', checkGoogleCalendar),
    Promise.resolve(checkSettings()),
    safely('Zoom links on invites', 'Upcoming session invites show the facilitator\'s Zoom link', checkInviteZoomLinks),
  ])
}
