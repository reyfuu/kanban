'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api'
import type { BulkResult, DecisionType, ReviewItem, SignoffResult } from './types'

export interface ActionError {
  ok: false
  code: string
  message: string
  field?: string
}

export type ActionResult<T> = ({ ok: true } & T) | ActionError

/**
 * Server actions for the reviewer screen.
 *
 * They exist so the session token stays in the httpOnly cookie on the Next
 * server and never reaches the browser (see lib/api). The password below is
 * the sharper case: it is posted to a server action and forwarded to the API
 * over the server-to-server hop. It is never held in client state, never put
 * in a field the browser persists, and never logged here.
 *
 * None of these actions decide anything. Every rule -- reason required, bulk
 * eligibility, sign-off completeness -- is re-evaluated by the API, because a
 * server action is still reached from the client and is not a trust boundary
 * for authorisation.
 */
export async function decideItem(input: {
  itemId: string
  decision: DecisionType
  reason: string | null
  secondsSpent: number
}): Promise<ActionResult<{ item: ReviewItem }>> {
  try {
    const item = await apiFetch<ReviewItem>(`/review-items/${input.itemId}/decision`, {
      method: 'POST',
      body: {
        decision: input.decision,
        ...(input.reason ? { reason: input.reason } : {}),
        seconds_spent: input.secondsSpent,
      },
    })
    revalidatePath('/review')
    return { ok: true, item }
  } catch (error) {
    return toActionError(error)
  }
}

export async function bulkDecide(input: {
  itemIds: string[]
  decision: DecisionType
  reason: string | null
  secondsSpent: number
}): Promise<ActionResult<{ result: BulkResult }>> {
  try {
    const result = await apiFetch<BulkResult>('/review-items/bulk-decision', {
      method: 'POST',
      body: {
        item_ids: input.itemIds,
        decision: input.decision,
        ...(input.reason ? { reason: input.reason } : {}),
        seconds_spent: input.secondsSpent,
      },
    })
    revalidatePath('/review')
    return { ok: true, result }
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * FR-B-015 · sign-off, which needs a step-up token first (FR-X-003).
 *
 * Both calls happen here, in one server-side sequence, so the short-lived token
 * never travels to the browser. It is bound to this session anyway, but a
 * credential that exists only inside one server call cannot be replayed from
 * somewhere else at all.
 */
export async function signoffCampaign(input: {
  campaignId: string
  password: string
  statement: string
  applicationIds: string[]
}): Promise<ActionResult<{ signoff: SignoffResult }>> {
  let stepUpToken: string
  try {
    const stepUp = await apiFetch<{ step_up_token: string; expires_in: number }>('/auth/step-up', {
      method: 'POST',
      body: { password: input.password },
    })
    stepUpToken = stepUp.step_up_token
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, code: 'WRONG_PASSWORD', message: 'Kata sandi salah.', field: 'password' }
    }
    return toActionError(error)
  }

  try {
    const signoff = await apiFetch<SignoffResult>(`/campaigns/${input.campaignId}/signoff`, {
      method: 'POST',
      body: {
        statement: input.statement,
        ...(input.applicationIds.length > 0 ? { scope: { application_ids: input.applicationIds } } : {}),
      },
      headers: { 'X-Step-Up-Token': stepUpToken },
    })
    revalidatePath('/review')
    return { ok: true, signoff }
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * Turns an ApiError into something renderable.
 *
 * The API's message is shown verbatim rather than replaced with a generic one:
 * the refusals on this screen are the control speaking ("this entitlement is
 * privileged, so Pertahankan still needs a reason"), and a reviewer who is told
 * only "gagal" learns nothing and tries the same thing again.
 */
function toActionError(error: unknown): ActionError {
  if (error instanceof ApiError) {
    const field = error.fieldErrors?.[0]?.field
    return {
      ok: false,
      code: error.code,
      message: error.fieldErrors?.[0]?.message ?? error.message,
      ...(field ? { field } : {}),
    }
  }
  return { ok: false, code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak terduga.' }
}
