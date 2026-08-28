import type { ReviewItemView } from './review-item.repository.js'
import { bulkExclusionReason, reasonRequired, reasonRequirementLabel } from './review-rules.js'

/**
 * Review item as the API contract renders it (07-API-CONTRACT Sec 5.6).
 *
 * The derived fields matter more than the plain ones. `bulk_eligible` and
 * `requires_reason_even_if_retained` are computed from the same functions the
 * write path uses, so the interface cannot advertise a permission the server
 * will then refuse -- an inconsistency that teaches reviewers the flags are
 * noise. They remain hints: the server re-derives both on every write, because
 * a hint a client can edit is not a control.
 *
 * There is deliberately no `decision` default. An undecided item serialises
 * `decision: null`, and the L-10 screen renders that as no radio selected.
 * Emitting "PERTAHANKAN" for an undecided item here would defeat K-2 at the
 * presentation layer while every database constraint still looked correct.
 */
export function presentReviewItem(item: ReviewItemView) {
  const exclusion = bulkExclusionReason(item.profile)

  return {
    id: item.id,
    campaign: {
      id: item.campaignId,
      name: item.campaignName,
      due_date: item.campaignDueDate.toISOString().slice(0, 10),
    },
    employee: item.employee
      ? {
          id: item.employee.id,
          full_name: item.employee.fullName,
          employee_number: item.employee.employeeNumber,
          job_title: item.employee.jobTitle,
          org_unit: { code: item.employee.orgUnitCode, name: item.employee.orgUnitName },
        }
      : null,
    application: item.application,
    account_id: item.accountId,
    entitlement: {
      code: item.entitlement.code,
      display_name: item.entitlement.displayName,
      business_description: item.entitlement.businessDescription,
      risk_level: item.entitlement.riskLevel,
      is_privileged: item.entitlement.isPrivileged,
    },
    context: {
      granted_at: item.context.grantedAt?.toISOString().slice(0, 10) ?? null,
      granted_by: item.context.grantedBy,
      last_access_at: item.context.lastAccessAt?.toISOString() ?? null,
      days_since_last_access: daysSince(item.context.lastAccessAt),
    },
    flags: [
      ...item.sodConflicts.map((c) => ({
        type: 'SOD_CONFLICT',
        severity: 'KRITIS',
        // FR-B-011 and L-10 rule 7: the business risk in a sentence, not just a
        // rule code. A manager who reads "melanggar SOD-01" learns nothing.
        message: c.riskDescription,
        rule_code: c.ruleCode,
      })),
      ...item.anomalies.map((a) => ({
        type: 'ANOMALY',
        severity: a.severity,
        message: `Anomali ${a.code} terdeteksi pada akses ini.`,
        rule_code: a.code,
      })),
    ],
    requires_reason_even_if_retained: reasonRequired('PERTAHANKAN', item.profile),
    reason_requirement_label: reasonRequirementLabel('PERTAHANKAN', item.profile),
    bulk_eligible: exclusion === null,
    bulk_exclusion_reason: exclusion,
    status: item.status,
    is_signed_off: item.isSignedOff,
    signed_off_at: item.signedOffAt?.toISOString() ?? null,
    decision: item.decision
      ? {
          decision: item.decision.decision,
          reason: item.decision.reason,
          decided_by: { full_name: item.decision.decidedByName },
          on_behalf_of: item.decision.onBehalfOfName,
          decided_at: item.decision.decidedAt.toISOString(),
          bulk_applied: item.decision.bulkApplied,
        }
      : null,
  }
}

function daysSince(date: Date | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}
