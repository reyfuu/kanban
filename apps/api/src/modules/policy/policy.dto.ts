import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Classification, DocumentType, ProcessArea } from '@prisma/client'

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
