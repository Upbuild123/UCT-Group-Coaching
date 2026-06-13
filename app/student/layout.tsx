import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/login/actions'
import Link from 'next/link'
import Image from 'next/image'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, timezone').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-6 flex-wrap">
        <Image src="/logo-white.png" alt="Upbuild" width={120} height={29} className="h-7 w-auto" priority />
        <Link href="/student/signup" className="nav-link">Sign Up</Link>
        <Link href="/student/sessions" className="nav-link">My Sessions</Link>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-slate-400">{profile?.name}</span>
          <span className="h-4 w-px bg-slate-700" />
          <form action={logout}>
            <button type="submit" className="nav-link">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="p-6 max-w-4xl mx-auto">{children}</main>
    </div>
  )
}
