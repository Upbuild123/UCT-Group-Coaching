import { adminClient } from '@/lib/supabase/admin'
import { sendNoShowCheckEmail } from '@/lib/email'
import { createNoShowToken } from '@/lib/tokens'
import { formatInTimeZone } from 'date-fns-tz'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) return NextResponse.json({ error: 'App URL not configured' }, { status: 500 })

  const now = new Date()
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()

  const { data: groups } = await adminClient
    .from('group_sessions')
    .select(`
      id, title, start_time_utc, original_timezone,
      users!facilitator_id(email),
      signups(id, status, users!student_id(name))
    `)
    .in('status', ['published', 'full'])
    .is('no_show_email_sent_at', null)
    .gte('end_time_utc', windowStart)
    .lte('end_time_utc', now.toISOString())

  for (const group of groups ?? []) {
    const facilitator = group.users as any
    const confirmedSignups = (group.signups ?? []).filter((s: any) => s.status === 'confirmed') as any[]

    if (facilitator?.email && confirmedSignups.length > 0) {
      await sendNoShowCheckEmail({
        facilitatorEmail: facilitator.email,
        groupTitle: group.title,
        startTimeFormatted: formatInTimeZone(new Date(group.start_time_utc), group.original_timezone, 'MMM d, yyyy h:mm a zzz'),
        students: confirmedSignups.map((s: any) => ({
          name: s.users.name,
          noShowUrl: `${baseUrl}/api/no-show/${createNoShowToken(s.id)}`,
        })),
      })
    }

    await adminClient
      .from('group_sessions')
      .update({ no_show_email_sent_at: new Date().toISOString() })
      .eq('id', group.id)
  }

  return NextResponse.json({ processed: groups?.length ?? 0 })
}
