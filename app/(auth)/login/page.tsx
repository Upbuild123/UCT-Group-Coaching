'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { login, sendMagicLink } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const error = params.get('error')
  const sent = params.get('sent')
  const isAdmin = params.get('admin') === '1'
  const [showPassword, setShowPassword] = useState(isAdmin)
  const [loading, setLoading] = useState(false)

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <p className="text-slate-700 font-medium">Check your email</p>
        <p className="text-sm text-slate-500">We sent a login link to <strong>{sent}</strong>. Click it to sign in.</p>
        <button onClick={() => window.location.href = '/login'} className="text-sm text-brand-600 hover:underline">
          Use a different email
        </button>
      </div>
    )
  }

  if (showPassword) {
    return (
      <form action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
          <input id="email" name="email" type="email" required className="input mt-1" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
          <input id="password" name="password" type="password" required className="input mt-1" />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
        <button type="button" onClick={() => setShowPassword(false)}
          className="w-full text-sm text-slate-500 hover:text-slate-700">
          ← Send me a login link instead
        </button>
      </form>
    )
  }

  return (
    <form action={sendMagicLink} onSubmit={() => setLoading(true)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
        <input id="email" name="email" type="email" required className="input mt-1" />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Sending...' : 'Send login link'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 px-4">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center space-y-2">
          <Image src="/logo-color.png" alt="Upbuild" width={160} height={38} className="mx-auto h-9 w-auto" priority />
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Group Coaching</h2>
          <p className="text-sm text-slate-500">Sign in to manage your sessions</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
