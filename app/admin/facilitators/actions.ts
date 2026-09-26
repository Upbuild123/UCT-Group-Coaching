'use server'

import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { updateEventZoomLink } from '@/lib/calendar'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createFacilitator(formData: FormData) {
  await requireAdmin()
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (authError) redirect(`/admin/facilitators?error=${encodeURIComponent(authError.message)}`)

  const { error: profileError } = await adminClient
    .from('users')
    .insert({ id: authUser.user.id, name, email, role: 'facilitator', timezone: 'America/New_York' })

  if (profileError) redirect(`/admin/facilitators?error=${encodeURIComponent(profileError.message)}`)

  revalidatePath('/admin/facilitators')
}

export async function deleteFacilitator(id: string) {
  await requireAdmin()
  await adminClient.auth.admin.deleteUser(id)
  revalidatePath('/admin/facilitators')
}

export async function bulkImportFacilitators(
  entries: Array<{ name: string; email: string; zoom_link?: string }>
): Promise<{ imported: number; errors: string[] }> {
  await requireAdmin()
  const errors: string[] = []
  let imported = 0

  for (const { name, email, zoom_link } of entries) {
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    })

    if (authError) {
      errors.push(`${name} (${email}): ${authError.message}`)
      continue
    }

    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        name,
        email,
        role: 'facilitator',
        timezone: 'America/New_York',
        zoom_link: zoom_link || null,
      })

    if (profileError) {
      errors.push(`${name} (${email}): ${profileError.message}`)
      continue
    }

    imported++
  }

  revalidatePath('/admin/facilitators')
  return { imported, errors }
}

export async function updateFacilitatorZoomLink(id: string, zoom_link: string) {
  await requireAdmin()
  const { data: before } = await adminClient.from('users').select('zoom_link').eq('id', id).single()
  await adminClient.from('users').update({ zoom_link: zoom_link || null }).eq('id', id)
  revalidatePath('/admin/facilitators')
  if ((before?.zoom_link ?? null) === (zoom_link || null)) return

  // Keep the Zoom link on this facilitator's upcoming calendar invites in sync
  const { data: groups } = await adminClient
    .from('group_sessions')
    .select('id, calendar_event_id')
    .eq('facilitator_id', id)
    .in('status', ['published', 'full'])
    .not('calendar_event_id', 'is', null)
    .gte('start_time_utc', new Date().toISOString())

  for (const group of groups ?? []) {
    try {
      await updateEventZoomLink(group.calendar_event_id!, zoom_link || null)
    } catch (err) {
      console.error('Calendar Zoom link update failed for group', group.id, err)
    }
  }
}
