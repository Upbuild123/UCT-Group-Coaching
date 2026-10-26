'use server'

import { requireAdmin } from '@/lib/auth'
import { findInvitesMissingZoom } from '@/lib/system-check'
import { updateEventZoomLink } from '@/lib/calendar'
import { revalidatePath } from 'next/cache'

// Adds the facilitator's Zoom link to upcoming invites that lack it, without emailing guests
export async function addMissingZoomLinks() {
  await requireAdmin()
  for (const invite of await findInvitesMissingZoom()) {
    try {
      await updateEventZoomLink(invite.calendarEventId, invite.zoomLink, { notify: false })
    } catch (err) {
      console.error('Zoom link backfill failed for group', invite.groupId, err)
    }
  }
  revalidatePath('/admin/system')
}
