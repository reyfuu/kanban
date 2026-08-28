'use server'

import { apiFetch, ApiError } from '@/lib/api'

export interface CampaignPreview {
  item_count: number
  reviewer_count: number
  application_count: number
  reviewer_load: {
    lowest: number
    median: number
    highest: number
    heaviest_reviewer: { full_name: string; item_count: number } | null
  }
  blockers: { code: string; message: string; applicationId?: string }[]
  warnings: { code: string; message: string; count?: number }[]
  can_launch: boolean
  applications: {
    id: string
    code: string
    name: string
    snapshot_id: string | null
    snapshot_age_days: number | null
    line_count: number
  }[]
}

export type Result<T> = ({ ok: true } & T) | { ok: false; message: string }

/**
 * The wizard's three server calls (L-09).
 *
 * `previewCampaign` is separate from `launchCampaign` on purpose, but both hit
 * the same resolution on the server, so what step 4 shows is what launch will
 * do. A preview computed by different code from the launch is a promise the
 * system does not keep.
 */
export async function createCampaign(input: {
  name: string
  campaignType: string
  applicationIds: string[]
  reviewerRule: string
  fallbackReviewerUserId: string
  startDate: string
  dueDate: string
}): Promise<Result<{ id: string; code: string }>> {
  try {
    const data = await apiFetch<{ id: string; code: string }>('/campaigns', {
      method: 'POST',
      body: {
        name: input.name,
        campaign_type: input.campaignType,
        application_ids: input.applicationIds,
        reviewer_rule: input.reviewerRule,
        fallback_reviewer_user_id: input.fallbackReviewerUserId,
        start_date: input.startDate,
        due_date: input.dueDate,
      },
    })
    return { ok: true, ...data }
  } catch (error) {
    return fail(error)
  }
}

export async function previewCampaign(campaignId: string): Promise<Result<{ preview: CampaignPreview }>> {
  try {
    const preview = await apiFetch<CampaignPreview>(`/campaigns/${campaignId}/preview`, {
      method: 'POST',
    })
    return { ok: true, preview }
  } catch (error) {
    return fail(error)
  }
}

export async function launchCampaign(campaignId: string): Promise<Result<{ itemCount: number }>> {
  try {
    const data = await apiFetch<{ item_count: number }>(`/campaigns/${campaignId}/launch`, {
      method: 'POST',
    })
    return { ok: true, itemCount: data.item_count }
  } catch (error) {
    return fail(error)
  }
}

function fail(error: unknown): { ok: false; message: string } {
  if (error instanceof ApiError) return { ok: false, message: error.message }
  return { ok: false, message: 'Terjadi kesalahan yang tidak terduga.' }
}
