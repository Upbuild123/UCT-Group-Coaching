'use server'

import { adminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createStudent(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const timezone = (formData.get('timezone') as string) || 'America/New_York'

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (authError) return { error: authError.message }

  const { error: profileError } = await adminClient
    .from('users')
    .insert({ id: authUser.user.id, name, email, role: 'student', timezone })

  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/students')
}

export async function deleteStudent(id: string) {
  await adminClient.auth.admin.deleteUser(id)
  revalidatePath('/admin/students')
}
