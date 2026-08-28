import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { AttestationTargetKind, Classification, DocumentType, ProcessArea } from '@prisma/client'

/**
 * Request shapes for Modul C (Policy Hub).
 *
 * Snake_case on the wire (07-API-CONTRACT), camelCase inside the service. The
 * translation happens in the controller so neither convention leaks into the
 * other.
 */

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string

  @IsEnum(DocumentType)
  document_type!: DocumentType

  @IsUUID()
  owner_org_unit_id!: string

  @IsUUID()
  owner_employee_id!: string

  /**
   * FR-C-003 aturan 1 & FR-X-018 aturan 1 · mandatory, and deliberately NOT
   * `@IsOptional()`. There is no default anywhere in the stack: not in the DTO,
   * not in the service, not in the column. A request that omits it is rejected,
   * because a document filed at the wrong classification is an access-control
   * failure and guessing is worse than refusing.
   */
  @IsEnum(Classification)
  classification!: Classification

  @IsEnum(ProcessArea)
  process_area!: ProcessArea

  @IsOptional()
  @IsString()
  @MaxLength(100)
  document_no?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[]

  @IsString()
  @IsNotEmpty()
  body!: string

  /** FR-C-006 aturan 4 · every version carries a change summary. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  change_summary!: string

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  related_document_ids?: string[]
}

export class TransitionDocumentDto {
  @IsString()
  @IsNotEmpty()
  to!: string

  /** FR-C-004 aturan 4 · required when withdrawing; checked in the service. */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason?: string
}

export class PutIntoForceDto {
  @IsDateString()
  effective_from!: string
}

export class CreateVersionDto {
  @IsString()
  @IsNotEmpty()
  body!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  change_summary!: string

  /** FR-C-006 aturan 1 · substantive change bumps major, editorial bumps minor. */
  @IsEnum({ MAYOR: 'MAYOR', MINOR: 'MINOR' })
  kind!: 'MAYOR' | 'MINOR'
}

export class SubmitForReviewDto {
  /** FR-C-006 aturan 2 · an editorial revision may skip skippable steps. */
  @IsOptional()
  @IsBoolean()
  is_minor?: boolean
}

export class ApprovalDecisionDto {
  @IsEnum({ SETUJU: 'SETUJU', DIKEMBALIKAN: 'DIKEMBALIKAN', DITOLAK: 'DITOLAK' })
  decision!: 'SETUJU' | 'DIKEMBALIKAN' | 'DITOLAK'

  /** FR-C-005 aturan 3 · every decision carries a comment. Never optional. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment!: string
}

export class CancelFlowDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string
}

export class LinkControlDto {
  @IsUUID()
  control_id!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class SearchDocumentsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  q!: string

  @IsOptional()
  @IsEnum(DocumentType)
  document_type?: DocumentType

  @IsOptional()
  @IsEnum(ProcessArea)
  process_area?: ProcessArea

  @IsOptional()
  @IsUUID()
  owner_org_unit_id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[]

  @IsOptional()
  @IsDateString()
  effective_from?: string

  @IsOptional()
  @IsDateString()
  effective_until?: string

  /** FR-C-010 aturan 3 · opt-in, role-gated, and audited. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  audit_mode?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number
}

/* ------------------------------------- FR-C-019 s.d. FR-C-021 · attestation - */

export class CreateAttestationCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  document_ids!: string[]

  @IsEnum(AttestationTargetKind)
  target_kind!: AttestationTargetKind

  /**
   * Parameters for the target rule. Shape depends on `target_kind` and is
   * validated in the service, where the rule that needs them lives -- a DTO
   * that tried to express "org_unit_ids required only when kind is UNIT" would
   * restate the rule in a second place and let the two drift.
   */
  @IsOptional()
  @IsObject()
  target_params?: Record<string, unknown>

  @IsDateString()
  start_date!: string

  @IsDateString()
  due_date!: string

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean

  @IsOptional()
  @IsBoolean()
  auto_enroll_new_employees?: boolean
}

export class AttestDto {
  /**
   * FR-C-020 · how long the document was open, reported by the client and
   * floor-checked by the server. The client cannot be trusted to be honest, but
   * it is the only thing that can observe the reading; the server's job is to
   * reject the implausible and record what it was told.
   */
  @IsInt()
  @Min(0)
  @Max(86_400)
  seconds_viewed!: number

  @IsOptional()
  @IsBoolean()
  reached_end?: boolean
}

export class ReattestationDecisionDto {
  @IsBoolean()
  required!: boolean
}

/**
 * FR-C-013 · a question to be answered from policy documents.
 *
 * The length floor is not cosmetic. A two-character question retrieves
 * essentially arbitrary chunks, and the gateway would then spend a real request
 * -- and a real per-user rate-limit slot (ADR-03 K8) -- sending them out. The
 * ceiling keeps a pasted document out of the payload; the answer feature reads
 * policy, it does not summarise whatever someone pastes into it.
 */
export class AskDocumentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  pertanyaan!: string
}
