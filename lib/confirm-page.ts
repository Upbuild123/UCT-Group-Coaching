// Email links must not act on GET: mail security scanners open every link in a message.
// Links render this page, and the action only runs when a person submits the form (POST).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function confirmPage({
  heading,
  message,
  buttonLabel,
  danger = false,
}: {
  heading: string
  message: string
  buttonLabel: string
  danger?: boolean
}): Response {
  const color = danger ? '#e11d48' : '#2563eb'
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0f172a; font-family: system-ui, -apple-system, sans-serif; padding: 16px; box-sizing: border-box; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 420px; width: 100%; text-align: center; }
  h1 { font-size: 20px; color: #0f172a; margin: 0 0 12px; }
  p { color: #475569; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
  button { background: ${color}; color: #fff; border: 0; border-radius: 8px; padding: 12px 20px;
    font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    <form method="post"><button type="submit">${escapeHtml(buttonLabel)}</button></form>
  </div>
</body>
</html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
