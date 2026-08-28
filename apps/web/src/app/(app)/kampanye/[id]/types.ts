/**
 * Response shapes for the campaign detail screen, mirroring what the API
 * presenters return (07-API-CONTRACT §5.5, §5.9). Kept here so the page and its
 * client panel share one definition rather than each guessing.
 */

export interface CampaignProgress {
  id: string
  name: string
  status: string
  due_date: string
  total_items: number
  decided_items: number
  completion_percent: number
  by_status: Record<string, number>
  by_decision: Record<string, number>
  applications: { id: string; code: string; name: string; item_count: number }[]
}

export interface Signoff {
  id: string
  signed_by: { id: string; full_name: string; job_title: string | null }
  signed_at: string
  ip_address: string
  layer_no: number
  decision_counts: Record<string, number>
  content_hash: string
  is_active: boolean
  reopened_at: string | null
  reopened_by: string | null
  reopen_reason: string | null
}

/** The presented pack (07-API-CONTRACT §5.9); `detail` is the frozen assembly. */
export interface EvidencePackage {
  evidence_id: string
  package_id: string
  title: string
  generated_at: string
  content_hash: string
  contents: {
    scope_summary: boolean
    methodology: boolean
    decision_detail: number
    signoff_records: number
    revocation_status: {
      total: number
      verified_closed: number
      failed: number
      excepted: number
      open: number
    }
    exceptions: number
    anomalies: number
    flagged_reviewers: number
  }
  auto_linked_control_ids: string[]
  formats: string[]
  detail: PackDetail
}

export interface PackDetail {
  title: string
  generated_for_campaign: { id: string; code: string; name: string }
  scope_summary: {
    applications: { id: string; code: string; name: string; item_count: number }[]
    period: { start_date: string; due_date: string }
    total_items: number
    decided_items: number
    undecided_items: number
    reviewer_count: number
  }
  flagged_reviewers: {
    reviewer_id: string
    reviewer_name: string
    item_count: number
    indicators: string[]
  }[]
}
