import 'server-only'
import { google } from 'googleapis'

function getCalendarClient() {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL,
  })
  return google.calendar({ version: 'v3', auth: jwt })
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!

export async function createCalendarEvent({
  title,
  startUtc,
  endUtc,
  facilitatorEmail,
  facilitatorName,
}: {
  title: string
  startUtc: Date
  endUtc: Date
  facilitatorEmail: string
  facilitatorName: string
}): Promise<string> {
  const calendar = getCalendarClient()

  const { data } = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    sendUpdates: 'all',
    requestBody: {
      summary: title,
      start: { dateTime: startUtc.toISOString(), timeZone: 'UTC' },
      end: { dateTime: endUtc.toISOString(), timeZone: 'UTC' },
      attendees: [{ email: facilitatorEmail, displayName: facilitatorName }],
    },
  })

  return data.id!
}

export async function addAttendeeToEvent({
  calendarEventId,
  email,
  displayName,
}: {
  calendarEventId: string
  email: string
  displayName: string
}): Promise<void> {
  const calendar = getCalendarClient()

  const { data: event } = await calendar.events.get({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
  })

  const attendees = event.attendees ?? []
  if (attendees.some(a => a.email === email)) return

  attendees.push({ email, displayName })

  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
    sendUpdates: 'all',
    requestBody: { attendees },
  })
}

export async function removeAttendeeFromEvent({
  calendarEventId,
  email,
}: {
  calendarEventId: string
  email: string
}): Promise<void> {
  const calendar = getCalendarClient()

  const { data: event } = await calendar.events.get({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
  })

  const attendees = (event.attendees ?? []).filter(a => a.email !== email)

  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
    sendUpdates: 'all',
    requestBody: { attendees },
  })
}

export async function cancelCalendarEvent(calendarEventId: string): Promise<void> {
  const calendar = getCalendarClient()
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
    sendUpdates: 'all',
  })
}
