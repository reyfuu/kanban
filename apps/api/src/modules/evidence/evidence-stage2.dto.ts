import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  Classification,
  EngagementStatus,
  EngagementType,
  EvidenceLinkTarget,
  EvidenceSource,
  FindingLifecycle,
  RiskLevel,
} from '@prisma/client'

/** Request shapes for Modul A stage 2. 07-API-CONTRACT Sec 4.3..4.6. */

class DateRangeDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}

export class CreateEngagementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string

  @IsEnum(EngagementType)
  engagement_type!: EngagementType

  @ValidateNested()
  @Type(() => DateRangeDto)
  period_covered!: DateRangeDto

  @IsOptional()
  @IsDateString()
  fieldwork_start?: string

  @IsOptional()
  @IsDateString()
  fieldwork_end?: string

  @IsUUID()
  lead_auditor_id!: string

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  team_member_ids?: string[]

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  control_ids?: string[]
}

export class EngagementTransitionDto {
  @IsEnum(EngagementStatus)
  to_status!: EngagementStatus

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}

export class LegalHoldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string
}

export class CreateRequestItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string

  @IsOptional()
  @IsUUID()
  control_id?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  evidence_period?: DateRangeDto

  @IsOptional()
  @IsUUID()
  responsible_org_unit_id?: string

  @IsUUID()
  pic_employee_id!: string

  @IsDateString()
  due_date!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expected_evidence_type?: string

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean
}

export class ReviewRequestItemDto {
  @IsEnum({ TERIMA: 'TERIMA', TOLAK: 'TOLAK', MINTA_INFO_TAMBAHAN: 'MINTA_INFO_TAMBAHAN' })
  decision!: 'TERIMA' | 'TOLAK' | 'MINTA_INFO_TAMBAHAN'

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}

export class NotApplicableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string
}

export class CreateEvidenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  evidence_type!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  validity_period?: DateRangeDto

  @IsOptional()
  @IsUUID()
  owner_org_unit_id?: string

  @IsEnum(Classification)
  classification!: Classification

  @IsEnum(EvidenceSource)
  source!: EvidenceSource
}

export class AddEvidenceVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storage_key!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  file_name!: string

  @IsString()
  @IsNotEmpty()
  file_size!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  mime_type!: string

  @IsString()
  @MinLength(64)
  @MaxLength(64)
  sha256!: string
}

export class CreateEvidenceLinkDto {
  @IsEnum(EvidenceLinkTarget)
  target_type!: EvidenceLinkTarget

  @IsUUID()
  target_id!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string
}

export class CreateFindingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  condition_text!: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  criteria_text?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  cause_text?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  effect_text?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  recommendation?: string

  @IsEnum(RiskLevel)
  risk_level!: RiskLevel

  @IsOptional()
  @IsUUID()
  owner_employee_id?: string

  @IsOptional()
  @IsUUID()
  recurring_of_id?: string

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  supporting_evidence_ids!: string[]
}

export class FindingTransitionDto {
  @IsEnum(FindingLifecycle)
  to_status!: FindingLifecycle

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}

export class CreateRemediationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string

  @IsUUID()
  owner_employee_id!: string

  @IsDateString()
  due_date!: string
}

export class EvidenceLegalHoldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string
}

export class ApproveDeletionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string
}

export class InviteExternalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string

  @IsDateString()
  access_until!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scope_note?: string
}

export class ExtendExternalDto {
  @IsDateString()
  access_until!: string
}

export class PortalProposeRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string

  @IsUUID()
  pic_employee_id!: string

  @IsDateString()
  due_date!: string
}
