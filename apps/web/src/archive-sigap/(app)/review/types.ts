/** The shape `GET /my/review-items` returns (07-API-CONTRACT §5.6). */
export type DecisionType = 'PERTAHANKAN' | 'CABUT' | 'UBAH' | 'ALIHKAN'
export type RiskLevel = 'KRITIS' | 'TINGGI' | 'SEDANG' | 'RENDAH'

export interface ReviewFlag {
  type: string
  severity: RiskLevel
  message: string
  rule_code: string
}

export interface ReviewItem {
  id: string
  campaign: { id: string; name: string; due_date: string }
  employee: {
    id: string
    full_name: string
    employee_number: string
    job_title: string | null
    org_unit: { code: string; name: string }
  } | null
  application: { id: string; code: string; name: string }
  account_id: string
  entitlement: {
    code: string
    display_name: string
    business_description: string | null
    risk_level: RiskLevel
    is_privileged: boolean
  }
  context: {
    granted_at: string | null
    granted_by: string | null
    last_access_at: string | null
    days_since_last_access: number | null
  }
  flags: ReviewFlag[]
  requires_reason_even_if_retained: boolean
  reason_requirement_label: string | null
  bulk_eligible: boolean
  bulk_exclusion_reason: string | null
  status: 'BELUM_DIPUTUSKAN' | 'DIPUTUSKAN' | 'DIALIHKAN' | 'ESKALASI'
  is_signed_off: boolean
  /** When it was actually signed — never substituted with the current time. */
  signed_off_at: string | null
  /**
   * `null` for an undecided item, and that is the point (K-2 / FR-B-012 rule 1).
   * There is no default here, no `?? 'PERTAHANKAN'` anywhere downstream, and no
   * component that renders a selected radio when this is null.
   */
  decision: {
    decision: DecisionType
    reason: string | null
    decided_by: { full_name: string }
    on_behalf_of: string | null
    decided_at: string
    bulk_applied: boolean
  } | null
}

export interface BulkResult {
  applied: number
  rejected: number
  rejections: {
    item_id: string
    code: string
    reason: string
    employee_name: string | null
    entitlement_display_name: string
  }[]
  bulk_flag_recorded: boolean
}

export interface SignoffResult {
  id: string
  signed_at: string
  content_hash: string
  scope_summary: {
    application_count: number
    item_count: number
    by_decision: Record<string, number>
  }
}

/** L-10 rule 2 — risky items get a full card, routine ones a compact row. */
export function needsFullCard(item: ReviewItem): boolean {
  return !item.bulk_eligible
}
