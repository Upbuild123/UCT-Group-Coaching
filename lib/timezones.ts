import { formatInTimeZone } from 'date-fns-tz'

export const TIMEZONES = [
  { label: 'Eastern (ET)', value: 'America/New_York' },
  { label: 'Central (CT)', value: 'America/Chicago' },
  { label: 'Mountain (MT)', value: 'America/Denver' },
  { label: 'Pacific (PT)', value: 'America/Los_Angeles' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris / Berlin (CET)', value: 'Europe/Paris' },
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'Japan (JST)', value: 'Asia/Tokyo' },
  { label: 'Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
]

// A session time in the viewer's chosen zone, labelled the same way as the timezone dropdown,
// e.g. "Wed, Nov 25, 2026 · 9:00 AM Japan (JST)"
export function formatSessionTime(startUtc: string | Date, timezone: string): string {
  const label = TIMEZONES.find(t => t.value === timezone)?.label
  const time = formatInTimeZone(new Date(startUtc), timezone, 'EEE, MMM d, yyyy · h:mm a')
  return label ? `${time} ${label}` : formatInTimeZone(new Date(startUtc), timezone, 'EEE, MMM d, yyyy · h:mm a zzz')
}
