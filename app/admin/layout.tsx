import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-white tracking-tight">Upbuild <span className="text-brand-400">Admin</span></span>
          <Link href="/admin/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/admin/rounds" className="nav-link">Rounds</Link>
          <Link href="/admin/students" className="nav-link">Students</Link>
          <Link href="/admin/attendance" className="nav-link">Attendance</Link>
          <Link href="/admin/facilitators" className="nav-link">Facilitators</Link>
        </div>
        <form action={logout}>
          <button type="submit" className="nav-link">Sign out</button>
        </form>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
