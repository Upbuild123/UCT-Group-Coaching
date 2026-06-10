import { adminClient } from '@/lib/supabase/admin'
import { sendSessionReminderEmail } from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString()

  const { data: groups } = await adminClient
    .from('group_sessions')
    .select(`
      id, title, start_time_utc,
      users!facilitator_id(email, timezone),
      signups(status, users!student_id(email, timezone))
    `)
    .in('status', ['published', 'full'])
    .is('reminder_sent_at', null)
    .gte('start_time_utc', windowStart)
    .lte('start_time_utc', windowEnd)

  for (const group of groups ?? []) {
    const recipients: { email: string; timezone: string }[] = []

    if (group.users) recipients.push(group.users as any)

    for (const signup of (group.signups ?? []) as any[]) {
      if (signup.status === 'confirmed' && signup.users) recipients.push(signup.users)
    }

    for (const recipient of recipients) {
      await sendSessionReminderEmail({
        to: [recipient.email],
        groupTitle: group.title,
        startTimeFormatted: formatInTimeZone(new Date(group.start_time_utc), recipient.timezone, 'MMM d, yyyy h:mm a zzz'),
      })
    }

    await adminClient
      .from('group_sessions')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', group.id)
  }

  return NextResponse.json({ processed: groups?.length ?? 0 })
}
