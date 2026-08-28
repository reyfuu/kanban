import {
  ArrayMaxSize,
  ArrayMinSize,
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
  MinLength,
} from 'class-validator'
import { ReviewDecisionType } from '@prisma/client'
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
