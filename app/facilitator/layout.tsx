import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'

export default async function FacilitatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (!profile || !['facilitator', 'admin'].includes(profile.role)) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Upbuild — Facilitator</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile.name}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
