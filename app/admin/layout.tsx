import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Upbuild Admin</span>
          <Link href="/admin/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/admin/rounds" className="text-sm text-gray-600 hover:text-gray-900">Rounds</Link>
          <Link href="/admin/students" className="text-sm text-gray-600 hover:text-gray-900">Students</Link>
          <Link href="/admin/attendance" className="text-sm text-gray-600 hover:text-gray-900">Attendance</Link>
          <Link href="/admin/facilitators" className="text-sm text-gray-600 hover:text-gray-900">Facilitators</Link>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
