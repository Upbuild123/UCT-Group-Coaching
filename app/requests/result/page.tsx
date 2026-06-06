export default async function RequestResultPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>
}) {
  const { outcome } = await searchParams

  const messages: Record<string, { heading: string; body: string; color: string }> = {
    approved: {
      heading: 'Request approved',
      body: 'The student has been added to the group. They will receive a confirmation email.',
      color: 'text-green-700',
    },
    rejected: {
      heading: 'Request rejected',
      body: 'The student has been notified that their request was not approved.',
      color: 'text-red-700',
    },
    already_resolved: {
      heading: 'Already resolved',
      body: 'This request has already been approved or rejected.',
      color: 'text-gray-700',
    },
    invalid: {
      heading: 'Invalid link',
      body: 'This link is invalid or has expired. Please contact michael@upbuild.com if you need help.',
      color: 'text-gray-700',
    },
    error: {
      heading: 'Something went wrong',
      body: 'An error occurred while processing this request. Please contact michael@upbuild.com for help.',
      color: 'text-gray-700',
    },
  }

  const validOutcomes = ['approved', 'rejected', 'already_resolved', 'invalid', 'error'] as const
  const key = validOutcomes.find(k => k === outcome) ?? 'invalid'
  const msg = messages[key]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <h1 className={`text-xl font-semibold mb-3 ${msg.color}`}>{msg.heading}</h1>
        <p className="text-gray-600 text-sm">{msg.body}</p>
      </div>
    </div>
  )
}
