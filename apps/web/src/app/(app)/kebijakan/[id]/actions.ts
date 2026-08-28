'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api'

export type ActionResult = { ok: true } | { ok: false; code: string; message: string }

/**
 * FR-C-020 · relay the attestation to the API.
 *
 * The dwell time and scroll flag come from the browser and are passed through
 * unchanged. This action deliberately does not sanity-check them: the server
 * holds the real floor, and a second, weaker check here would create two places
 * where the rule lives and one of them would eventually drift.
 *
 * The IP address is never sent from here either. The API reads it from the
 * request, because an attestation whose IP the attester could choose records
 * nothing.
 */
export async function submitAttestation(
  taskId: string,
  secondsViewed: number,
  reachedEnd: boolean,
): Promise<ActionResult> {
  try {
    await apiFetch(`/attestation/tugas/${taskId}/nyatakan`, {
      method: 'POST',
      body: { seconds_viewed: secondsViewed, reached_end: reachedEnd },
    })
    revalidatePath('/attestation')
    return { ok: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message }
    }
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'Pernyataan gagal dicatat. Coba lagi sebentar lagi.',
    }
  }
}
