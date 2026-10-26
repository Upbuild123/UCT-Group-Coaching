'use client'

import { useFormStatus } from 'react-dom'

// Shows that a server action is running, so a slow action doesn't look like a dead button
export default function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : label}
    </button>
  )
}
