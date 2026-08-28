import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ControlFrequency, ControlNature, ControlType, CoverageLevel, RiskLevel } from '@prisma/client'

/**
 * Request shapes for Modul A (Evidence Vault) — control library and framework
 * mapping. 07-API-CONTRACT Sec 4.1, 4.2.
 */
export class CreateControlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  objective!: string

  @IsUUID()
  owner_employee_id!: string

  @IsOptional()
  @IsUUID()
  executing_org_unit_id?: string

  @IsEnum(ControlFrequency)
  frequency!: ControlFrequency

  @IsEnum(ControlType)
  control_type!: ControlType

  @IsEnum(ControlNature)
  nature!: ControlNature

  @IsEnum(RiskLevel)
  risk_level!: RiskLevel

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  test_procedure?: string

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  expected_evidence_types!: string[]
}

/** PATCH: every field optional; `code` deliberately absent (FR-A-001 rule 1). */
export class UpdateControlDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objective?: string

  @IsOptional()
  @IsUUID()
  owner_employee_id?: string

  @IsOptional()
  @IsUUID()
  executing_org_unit_id?: string

  @IsOptional()
  @IsEnum(ControlFrequency)
  frequency?: ControlFrequency

  @IsOptional()
  @IsEnum(ControlType)
  control_type?: ControlType

  @IsOptional()
  @IsEnum(ControlNature)
  nature?: ControlNature

  @IsOptional()
  @IsEnum(RiskLevel)
  risk_level?: RiskLevel

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  test_procedure?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  expected_evidence_types?: string[]
}

export class CreateMappingDto {
  @IsUUID()
  framework_item_id!: string

  @IsEnum(CoverageLevel)
  coverage_level!: CoverageLevel

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string
}

export class FrameworkItemImportRow {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ref!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parent_ref?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number
}

export class ImportFrameworkItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FrameworkItemImportRow)
  items!: FrameworkItemImportRow[]
}
