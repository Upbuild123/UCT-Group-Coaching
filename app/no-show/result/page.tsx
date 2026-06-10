export default async function NoShowResultPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>
}) {
  const { outcome } = await searchParams

  const messages: Record<string, { heading: string; body: string; color: string }> = {
    marked: {
      heading: 'Marked as no-show',
      body: 'Thanks — this student has been marked as a no-show for this session.',
      color: 'text-green-700',
    },
    already_marked: {
      heading: 'Already marked',
      body: 'This student has already been marked as a no-show.',
      color: 'text-gray-700',
    },
    invalid: {
      heading: 'Invalid link',
      body: 'This link is invalid or has expired. Please contact michael@upbuild.com if you need help.',
      color: 'text-gray-700',
    },
  }

  const validOutcomes = ['marked', 'already_marked', 'invalid'] as const
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
