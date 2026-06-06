'use server'

import { adminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createFacilitator(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (authError) throw new Error(authError.message)

  const { error: profileError } = await adminClient
    .from('users')
    .insert({ id: authUser.user.id, name, email, role: 'facilitator', timezone: 'America/New_York' })

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/admin/facilitators')
}

export async function deleteFacilitator(id: string) {
  await adminClient.auth.admin.deleteUser(id)
  revalidatePath('/admin/facilitators')
}

export async function bulkImportFacilitators(
  entries: Array<{ name: string; email: string; zoom_link?: string }>
): Promise<{ imported: number; errors: string[] }> {
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
  await adminClient.from('users').update({ zoom_link: zoom_link || null }).eq('id', id)
  revalidatePath('/admin/facilitators')
}
