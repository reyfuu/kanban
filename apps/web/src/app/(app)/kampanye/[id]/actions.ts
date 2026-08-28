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

/** For actions that return no payload beyond success. */
export type SimpleResult = { ok: true } | ActionError

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

/**
 * FR-B-010 · campaign lifecycle actions from the detail screen.
 *
 * Launch, extend and cancel. Each re-checks its rule in the API (a draft is
 * launched by campaign:write; a running campaign is cancelled only with
 * COMPLIANCE; extension is capped at two), so these relay and revalidate. The
 * refusal is shown verbatim because it is the rule speaking.
 */
export async function launchCampaign(campaignId: string): Promise<SimpleResult> {
  return lifecycle(campaignId, `/campaigns/${campaignId}/launch`, {})
}

export async function extendCampaign(
  campaignId: string,
  input: { dueDate: string; reason: string },
): Promise<SimpleResult> {
  return lifecycle(campaignId, `/campaigns/${campaignId}/extend`, {
    due_date: input.dueDate,
    reason: input.reason,
  })
}

export async function cancelCampaign(
  campaignId: string,
  reason: string,
): Promise<SimpleResult> {
  return lifecycle(campaignId, `/campaigns/${campaignId}/cancel`, { reason })
}

async function lifecycle(
  campaignId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<SimpleResult> {
  try {
    await apiFetch(path, { method: 'POST', body })
    revalidatePath(`/kampanye/${campaignId}`)
    revalidatePath('/kampanye')
    return { ok: true }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message }
    return { ok: false, code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak terduga.' }
  }
}
