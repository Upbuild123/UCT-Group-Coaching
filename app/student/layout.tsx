import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'
import Link from 'next/link'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, timezone').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Upbuild Coaching</span>
          <Link href="/student/signup" className="text-sm text-gray-600 hover:text-gray-900">Sign Up</Link>
          <Link href="/student/sessions" className="text-sm text-gray-600 hover:text-gray-900">My Sessions</Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile?.name}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
