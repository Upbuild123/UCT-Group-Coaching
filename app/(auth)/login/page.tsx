'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, sendMagicLink } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const error = params.get('error')
  const sent = params.get('sent')
  const isAdmin = params.get('admin') === '1'
  const [showPassword, setShowPassword] = useState(isAdmin)

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <p className="text-gray-700">Check your email</p>
        <p className="text-sm text-gray-500">We sent a login link to <strong>{sent}</strong>. Click it to sign in.</p>
        <button onClick={() => window.location.href = '/login'} className="text-sm text-blue-600 hover:underline">
          Use a different email
        </button>
      </div>
    )
  }

  if (showPassword) {
    return (
      <form action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input id="email" name="email" type="email" required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <input id="password" name="password" type="password" required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Sign in
        </button>
        <button type="button" onClick={() => setShowPassword(false)}
          className="w-full text-sm text-gray-500 hover:text-gray-700">
          ← Send me a login link instead
        </button>
      </form>
    )
  }

  return (
    <form action={sendMagicLink} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input id="email" name="email" type="email" required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit"
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        Send login link
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center">Upbuild Coaching</h2>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
