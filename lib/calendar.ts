import 'server-only'
import { google, calendar_v3 } from 'googleapis'

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
  zoomLink,
}: {
  title: string
  startUtc: Date
  endUtc: Date
  facilitatorEmail: string
  facilitatorName: string
  zoomLink?: string | null
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
      ...zoomFields(zoomLink),
    },
  })

  return data.id!
}

function zoomFields(zoomLink: string | null | undefined) {
  return {
    location: zoomLink ?? '',
    description: zoomLink ? `Join Zoom: ${zoomLink}` : '',
  }
}

export async function updateEventZoomLink(
  calendarEventId: string,
  zoomLink: string | null
): Promise<void> {
  const calendar = getCalendarClient()
  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
    sendUpdates: 'all',
    requestBody: zoomFields(zoomLink),
  })
}

// Attendee lists are read, changed, and written back, so two changes to the same event at once
// could overwrite each other. The write is conditional on the event's etag; on a conflict (412)
// we re-read and try again.
async function updateAttendees(
  calendarEventId: string,
  change: (attendees: calendar_v3.Schema$EventAttendee[]) => calendar_v3.Schema$EventAttendee[] | null
): Promise<void> {
  const calendar = getCalendarClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: event } = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId: calendarEventId,
    })

    const attendees = change(event.attendees ?? [])
    if (!attendees) return

    try {
      await calendar.events.patch(
        {
          calendarId: CALENDAR_ID,
          eventId: calendarEventId,
          sendUpdates: 'all',
          requestBody: { attendees },
        },
        { headers: { 'If-Match': event.etag! } }
      )
      return
    } catch (err) {
      const status = (err as { code?: number; status?: number }).code ?? (err as { status?: number }).status
      if (status !== 412) throw err
    }
  }

  throw new Error(`Calendar event ${calendarEventId}: attendee update kept conflicting, gave up`)
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
  await updateAttendees(calendarEventId, attendees =>
    attendees.some(a => a.email === email) ? null : [...attendees, { email, displayName }]
  )
}

export async function removeAttendeeFromEvent({
  calendarEventId,
  email,
}: {
  calendarEventId: string
  email: string
}): Promise<void> {
  await updateAttendees(calendarEventId, attendees =>
    attendees.some(a => a.email === email) ? attendees.filter(a => a.email !== email) : null
  )
}

export async function cancelCalendarEvent(calendarEventId: string): Promise<void> {
  const calendar = getCalendarClient()
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId: calendarEventId,
    sendUpdates: 'all',
  })
}
