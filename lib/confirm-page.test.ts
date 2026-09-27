import { describe, it, expect } from 'vitest'
import { confirmPage } from './confirm-page'

describe('confirmPage', () => {
  it('renders a POST form so the action needs a click', async () => {
    const html = await confirmPage({ heading: 'Approve?', message: 'Jo asked to join', buttonLabel: 'Approve' }).text()
    expect(html).toContain('<form method="post">')
    expect(html).toContain('Approve</button>')
  })

  it('escapes names from the database', async () => {
    const html = await confirmPage({ heading: 'X', message: '<script>alert(1)</script>', buttonLabel: 'Go' }).text()
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })
})
