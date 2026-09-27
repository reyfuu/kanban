'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api'

export interface ActionError {
  ok: false
  code: string
  message: string
}
export type ActionResult = { ok: true } | ActionError

/**
 * Server actions for the revocation-ticket lifecycle (FR-B-019 s.d. FR-B-021).
 *
 * The token stays in the httpOnly cookie on the Next server; these only relay.
 * None of them can close a ticket as verified: there is no such action here and
 * none in the API either. `verify-now` asks the latest snapshot whether the
 * access is gone and records the answer -- K-1 is enforced by the database, not
 * by any button, so the worst a wrong click can do is ask the question early.
 */
export async function claimTicket(id: string): Promise<ActionResult> {
  return run(`/revocation-tickets/${id}/claim`, {})
}

export async function completeTicket(
  id: string,
  input: { executionNote: string; externalTicketRef?: string },
): Promise<ActionResult> {
  return run(`/revocation-tickets/${id}/complete`, {
    execution_note: input.executionNote,
    ...(input.externalTicketRef ? { external_ticket_ref: input.externalTicketRef } : {}),
  })
}

export async function exceptTicket(id: string, reason: string): Promise<ActionResult> {
  return run(`/revocation-tickets/${id}/exception`, { reason })
}

export async function verifyTicketNow(id: string): Promise<ActionResult> {
  return run(`/revocation-tickets/${id}/verify-now`, {})
}

async function run(path: string, body: Record<string, unknown>): Promise<ActionResult> {
  try {
    await apiFetch(path, { method: 'POST', body })
    revalidatePath('/tiket')
    return { ok: true }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message }
    return { ok: false, code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak terduga.' }
  }
}
