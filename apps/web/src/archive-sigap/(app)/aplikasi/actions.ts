'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api'

export interface ActionError {
  ok: false
  code: string
  message: string
}
export type ActionResult = { ok: true; id?: string } | ActionError

export interface ApplicationFormInput {
  code: string
  name: string
  ownerEmployeeId: string
  techOwnerEmployeeId: string | null
  criticality: string
  hostingType: string
  reviewFrequency: string
}

/**
 * FR-B-001 · create / edit / deactivate an application from the registry screen.
 *
 * The token stays server-side; these relay to the API, which re-checks
 * `application:write` and validates the owner ids. A duplicate code, an unknown
 * owner, or an edit to a deactivated application all come back as a verbatim
 * refusal so the person sees exactly what to fix.
 */
export async function createApplication(input: ApplicationFormInput): Promise<ActionResult> {
  try {
    const result = await apiFetch<{ id: string }>('/applications', {
      method: 'POST',
      body: toBody(input),
    })
    revalidatePath('/aplikasi')
    return { ok: true, id: result.id }
  } catch (error) {
    return toError(error)
  }
}

export async function updateApplication(
  id: string,
  input: Omit<ApplicationFormInput, 'code'>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/applications/${id}`, { method: 'PATCH', body: toBody(input) })
    revalidatePath('/aplikasi')
    return { ok: true }
  } catch (error) {
    return toError(error)
  }
}

export async function deactivateApplication(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/applications/${id}/deactivate`, { method: 'POST' })
    revalidatePath('/aplikasi')
    return { ok: true }
  } catch (error) {
    return toError(error)
  }
}

function toBody(input: Partial<ApplicationFormInput>): Record<string, unknown> {
  return {
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.ownerEmployeeId !== undefined ? { owner_employee_id: input.ownerEmployeeId } : {}),
    ...(input.techOwnerEmployeeId
      ? { tech_owner_employee_id: input.techOwnerEmployeeId }
      : {}),
    ...(input.criticality !== undefined ? { criticality: input.criticality } : {}),
    ...(input.hostingType !== undefined ? { hosting_type: input.hostingType } : {}),
    ...(input.reviewFrequency !== undefined ? { review_frequency: input.reviewFrequency } : {}),
  }
}

function toError(error: unknown): ActionError {
  if (error instanceof ApiError) {
    return { ok: false, code: error.code, message: error.fieldErrors?.[0]?.message ?? error.message }
  }
  return { ok: false, code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak terduga.' }
}
