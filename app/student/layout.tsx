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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-white tracking-tight">Upbuild <span className="text-brand-400">Coaching</span></span>
        <Link href="/student/signup" className="nav-link">Sign Up</Link>
        <Link href="/student/sessions" className="nav-link">My Sessions</Link>
        <span className="text-sm text-slate-400">{profile?.name}</span>
        <form action={logout}>
          <button type="submit" className="nav-link">Sign out</button>
        </form>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
