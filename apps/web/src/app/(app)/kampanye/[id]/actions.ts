'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api'
import type { EvidencePackage } from './types'

export interface ActionError {
  ok: false
  code: string
  message: string
}

export type ActionResult<T> = ({ ok: true } & T) | ActionError

/**
 * FR-B-022 · form the campaign evidence package.
 *
 * A server action so the session token stays in the httpOnly cookie on the Next
 * server. It decides nothing: the API re-checks every precondition (all items
 * decided, every scope signed off, campaign not already closed) and this only
 * relays the refusal verbatim, because those refusals are the control speaking
 * -- "masih ada 2 item" tells the person exactly what to finish.
 */
export async function generateEvidencePackage(
  campaignId: string,
): Promise<ActionResult<{ pack: EvidencePackage }>> {
  try {
    const pack = await apiFetch<EvidencePackage>(`/campaigns/${campaignId}/evidence-package`, {
      method: 'POST',
    })
    revalidatePath(`/kampanye/${campaignId}`)
    revalidatePath('/kampanye')
    return { ok: true, pack }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message }
    }
    return { ok: false, code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak terduga.' }
  }
}
