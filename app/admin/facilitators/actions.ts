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
  if (authError) return { error: authError.message }

  const { error: profileError } = await adminClient
    .from('users')
    .insert({ id: authUser.user.id, name, email, role: 'facilitator', timezone: 'America/New_York' })

  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/facilitators')
}

export async function deleteFacilitator(id: string) {
  await adminClient.auth.admin.deleteUser(id)
  revalidatePath('/admin/facilitators')
}

export async function bulkImportFacilitators(
  entries: Array<{ name: string; email: string }>
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = []
  let imported = 0

  for (const { name, email } of entries) {
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
      .insert({ id: authUser.user.id, name, email, role: 'facilitator', timezone: 'America/New_York' })

    if (profileError) {
      errors.push(`${name} (${email}): ${profileError.message}`)
      continue
    }

    imported++
  }

  revalidatePath('/admin/facilitators')
  return { imported, errors }
}
