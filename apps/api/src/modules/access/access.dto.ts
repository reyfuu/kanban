import {
  ArrayMaxSize,
  IsBoolean,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { CampaignType, ReviewDecisionType } from '@prisma/client'
import { BULK_MAX_ITEMS } from './review-rules.js'

/**
 * Request shapes for Modul B.
 *
 * Note what is missing from DecisionDto: a default for `decision`. K-2 requires
 * that an item without an explicit choice stays undecided, so `decision` is
 * required and has no fallback here, none in the service, and no DEFAULT in the
 * column. A request that omits it is rejected, never interpreted.
 */
export class DecisionDto {
  @IsEnum(ReviewDecisionType, { message: 'Keputusan harus salah satu dari Pertahankan, Cabut, Ubah, atau Alihkan.' })
  decision!: ReviewDecisionType

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  seconds_spent?: number

  @IsOptional()
  @IsUUID()
  reassign_to_user_id?: string
}

export class BulkDecisionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Pilih setidaknya satu item.' })
  @ArrayMaxSize(BULK_MAX_ITEMS, {
    message: `Keputusan massal maksimum ${BULK_MAX_ITEMS} item sekali terap.`,
  })
  @IsUUID('4', { each: true })
  item_ids!: string[]

  @IsEnum(ReviewDecisionType)
  decision!: ReviewDecisionType

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  seconds_spent?: number
}

export class SignoffScopeDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  application_ids?: string[]
}

export class SignoffDto {
  @IsOptional()
  scope?: SignoffScopeDto

  /** FR-B-015 rule 3 — the statement is part of what the fingerprint covers. */
  @IsString()
  @IsNotEmpty({ message: 'Pernyataan sign-off wajib diisi.' })
  @MinLength(20)
  @MaxLength(2000)
  statement!: string
}

export class ReopenSignoffDto {
  @IsString()
  @MinLength(10, { message: 'Alasan pembukaan kembali wajib diisi minimal 10 karakter.' })
  @MaxLength(2000)
  reason!: string
}

/**
 * Ticket action bodies (07-API-CONTRACT §5.8) — K-1.
 *
 * Note what no shape here contains: a target status. The contract models these
 * as named sub-resources (`/claim`, `/complete`, `/exception`) rather than a
 * status field, and that is the stronger design for K-1 — there is no field in
 * which a caller could ask for TERVERIFIKASI_TERTUTUP, so there is nothing to
 * validate and nothing to get the validation wrong about. The state machine in
 * RevocationService still guards the transitions; this layer means the
 * forbidden request cannot even be phrased.
 */
export class CompleteTicketDto {
  @IsString()
  @MinLength(10, { message: 'Keterangan pelaksanaan wajib diisi minimal 10 karakter.' })
  @MaxLength(2000)
  execution_note!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  external_ticket_ref?: string
}

export class TicketExceptionDto {
  @IsString()
  @MinLength(10, { message: 'Alasan pengecualian wajib diisi minimal 10 karakter.' })
  @MaxLength(2000)
  reason!: string
}

/** FR-B-008 · campaign construction. */
export class CreateCampaignDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  name!: string

  @IsEnum(CampaignType)
  campaign_type!: CampaignType

  @IsArray()
  @ArrayNotEmpty({ message: 'Kampanye harus mencakup setidaknya satu aplikasi.' })
  @IsUUID('4', { each: true })
  application_ids!: string[]

  @IsIn(['RA-01', 'RA-02', 'RA-03', 'RA-04', 'RA-05'], {
    message: 'Aturan penugasan reviewer harus salah satu dari RA-01 sampai RA-05.',
  })
  reviewer_rule!: 'RA-01' | 'RA-02' | 'RA-03' | 'RA-04' | 'RA-05'

  @IsOptional()
  @IsUUID()
  specific_reviewer_user_id?: string

  /** FR-B-009 rule 1 makes this mandatory, not a convenience. */
  @IsUUID()
  fallback_reviewer_user_id!: string

  @IsDateString({}, { message: 'Tanggal mulai tidak sah.' })
  start_date!: string

  @IsDateString({}, { message: 'Tenggat tidak sah.' })
  due_date!: string
}

export class ExtendCampaignDto {
  @IsDateString()
  due_date!: string

  @IsString()
  @MinLength(10, { message: 'Alasan perpanjangan wajib diisi minimal 10 karakter.' })
  @MaxLength(2000)
  reason!: string
}

export class CancelCampaignDto {
  @IsString()
  @MinLength(10, { message: 'Alasan pembatalan wajib diisi minimal 10 karakter.' })
  @MaxLength(2000)
  reason!: string
}

/**
 * FR-B-004 aturan 4 and 6 · continuing a validated upload.
 *
 * `skip_invalid_rows` and `confirm_warnings` are both required decisions with
 * no server-side default that means "yes". An omitted flag leaves the upload
 * refused, which is the safe direction: the failure mode this rule exists to
 * prevent is an incomplete export entering silently.
 */
export class CommitUploadDto {
  @IsUUID()
  validation_id!: string

  @IsOptional()
  @IsBoolean()
  skip_invalid_rows?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  confirm_warnings?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  confirmation_note?: string
}

/**
 * FR-B-007 aturan 2 · an exception on an anomaly.
 *
 * Every field is required: an exception without a compensating control or a
 * review date is exactly the "quietly kept forever" the rule exists to prevent.
 * The review date's future-and-bounded check is in the service, where "now" is
 * available.
 */
export class AnomalyExceptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  compensating_control!: string

  @IsDateString()
  review_date!: string
}

/** FR-B-025 · an exception on an SoD violation. */
export class SodExceptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  business_reason!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  compensating_control!: string

  @IsUUID()
  approved_by!: string

  @IsDateString()
  review_date!: string
}

/**
 * FR-B-024 aturan 4 · simulate a rule before activating it.
 *
 * Groups are free-form JSON objects carrying `entitlement_ids` and/or
 * `entitlement_codes`; the shape is validated in the service via
 * `resolveGroupEntitlementIds`, which drops unknown codes rather than failing.
 */
export class SodSimulateDto {
  @IsObject()
  group_a!: Record<string, unknown>

  @IsObject()
  group_b!: Record<string, unknown>
}
