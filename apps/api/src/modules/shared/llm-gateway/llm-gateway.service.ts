import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import type { Classification } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service.js'
import { applyClassificationGate, type Chunk } from './classification-gate.js'
import { RedactionFailedError, redactForExternal } from './redaction.js'
import { LlmProvider, type LlmAnswer } from './llm-provider.js'

export interface AskInput {
  readonly askedByUserId: string
  readonly question: string
  /** Chunks already filtered by the asker's entitlements (FR-C-013 rule 1). */
  readonly chunks: readonly Chunk[]
}

export interface Citation {
  readonly chunkId: string
  readonly documentId: string
  readonly documentTitle: string
  readonly versionLabel: string
  readonly sectionNo: string
}

export type AskResult =
  | {
      readonly status: 'JAWABAN'
      readonly answer: string
      readonly citations: readonly Citation[]
      /** FR-C-014 rule 3 · some sources were withheld by classification. */
      readonly partial: boolean
      readonly notice: string
      readonly logId: string
    }
  | {
      readonly status: 'TIDAK_TERSEDIA'
      readonly reason: string
      readonly logId: string
    }

/**
 * ADR-03 · the single egress path to an external language provider.
 *
 * ADR-03 calls this the most critical control point in the architecture, and
 * the ordering of the steps below is the control. It follows the sequence
 * diagram exactly:
 *
 *   1. circuit breaker      (FR-C-017)
 *   2. classification gate  (FR-C-014)
 *   3. redaction            (FR-C-015)
 *   4. log BEFORE sending   (FR-C-016)
 *   5. send
 *   6. verify citations     (K10 / FR-C-013 rule 3)
 *   7. log the response     (FR-C-016)
 *
 * Step 4 is the one that is easy to get subtly wrong and matters most. The
 * payload is written to the log BEFORE the provider is called, not after. If it
 * were written afterwards, a crash or timeout mid-call would leave data that
 * had already left the building with no record that it ever did -- and the
 * gateway log's whole purpose is to be able to answer, later, exactly what was
 * sent. Logging first means the worst case is a row describing a send that may
 * not have completed, which is the safe direction to be wrong in.
 *
 * Every refusal is logged too (FR-C-016 rule 3). A log containing only
 * successful sends cannot show that the gate ever refused anything, which is
 * precisely the question Compliance asks of it.
 */
@Injectable()
export class LlmGatewayService {
  private readonly log = new Logger(LlmGatewayService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: LlmProvider,
  ) {}

  async ask(input: AskInput): Promise<AskResult> {
    const started = Date.now()
    const logId = randomUUID()

    // --- 1. FR-C-017 · circuit breaker -------------------------------------
    const setting = await this.prisma.llmGatewaySetting.findFirst()
    if (!setting?.enabled) {
      return this.refuse(logId, input, 'DITOLAK_PEMUTUS', {
        reason:
          setting?.disabledReason ??
          'Fitur jawaban otomatis sedang tidak tersedia. Pencarian dokumen tetap berjalan.',
      })
    }

    // --- K8 · per-user rate limit ------------------------------------------
    const anHourAgo = new Date(Date.now() - 3_600_000)
    const recent = await this.prisma.llmRequestLog.count({
      where: {
        askedByUserId: input.askedByUserId,
        occurredAt: { gte: anHourAgo },
        outcome: 'DITERUSKAN',
      },
    })
    if (recent >= setting.maxRequestsPerUserPerHour) {
      return this.refuse(logId, input, 'DITOLAK_BATAS', {
        reason: `Batas ${setting.maxRequestsPerUserPerHour} permintaan per jam tercapai. Coba lagi nanti.`,
      })
    }

    // --- 2. FR-C-014 · classification gate ---------------------------------
    const gate = applyClassificationGate(input.chunks)
    if (gate.outcome === 'DITOLAK_KLASIFIKASI') {
      return this.refuse(logId, input, 'DITOLAK_KLASIFIKASI', {
        reason: gate.reason,
        chunks: input.chunks,
      })
    }

    // --- 3. FR-C-015 · redaction -------------------------------------------
    //
    // The question itself is redacted too (FR-C-014 rule 4): a user can paste a
    // customer's account number into the search box, and a gate that only
    // cleans the documents would send it straight out.
    let questionRedacted: string
    let context: { ref: string; text: string }[]
    try {
      questionRedacted = redactForExternal(input.question).text
      context = gate.sendable.map((c) => ({
        ref: c.id,
        text: redactForExternal(c.text).text,
      }))
    } catch (error) {
      if (error instanceof RedactionFailedError) {
        // Rule 2: cancel, never forward. Logged so the failure is visible
        // rather than appearing as a request that simply never happened.
        return this.refuse(logId, input, 'DITOLAK_REDAKSI', {
          reason: 'Proses redaksi gagal, pengiriman dibatalkan.',
          chunks: gate.sendable,
        })
      }
      throw error
    }

    // --- 4. FR-C-016 · log BEFORE sending ----------------------------------
    await this.prisma.llmRequestLog.create({
      data: {
        id: logId,
        askedByUserId: input.askedByUserId,
        questionRaw: input.question,
        questionRedacted,
        outcome: 'DITERUSKAN',
        chunksReferenced: this.chunkSummary(gate.sendable),
        payloadSent: { question: questionRedacted, context },
        providerName: this.provider.name,
      },
    })

    // --- 5. send ------------------------------------------------------------
    let answer: LlmAnswer
    try {
      answer = await this.provider.generate({ question: questionRedacted, context })
    } catch (error) {
      this.log.error(`Penyedia gagal: ${String(error)}`)
      await this.prisma.llmRequestLog.update({
        where: { id: logId },
        data: {
          outcome: 'GAGAL_PENYEDIA',
          refusalReason: String(error),
          durationMs: Date.now() - started,
        },
      })
      return {
        status: 'TIDAK_TERSEDIA',
        reason: 'Layanan jawaban otomatis sedang tidak dapat dihubungi.',
        logId,
      }
    }

    // --- 6. K10 · citations must exist AND be verifiable --------------------
    //
    // Verified against the chunks actually sent, not merely counted. A model
    // that invents a plausible-looking reference produces an answer that is
    // more dangerous than no answer at all: it carries the appearance of
    // sourcing, so the reader stops checking.
    const sentIds = new Set(gate.sendable.map((c) => c.id))
    const verified = answer.citations.filter((c) => sentIds.has(c))
    if (verified.length === 0) {
      await this.prisma.llmRequestLog.update({
        where: { id: logId },
        data: {
          outcome: 'DITOLAK_TANPA_RUJUKAN',
          refusalReason: 'Jawaban tidak menyertakan rujukan yang dapat diverifikasi.',
          responseReceived: { text: answer.text, citations: answer.citations },
          tokensPrompt: answer.tokensPrompt,
          tokensCompletion: answer.tokensCompletion,
          costMicros: answer.costMicros,
          durationMs: Date.now() - started,
        },
      })
      return {
        status: 'TIDAK_TERSEDIA',
        reason:
          'Sistem tidak menemukan dasar yang memadai untuk menjawab. Gunakan hasil pencarian dokumen.',
        logId,
      }
    }

    // --- 7. FR-C-016 · log the response ------------------------------------
    await this.prisma.llmRequestLog.update({
      where: { id: logId },
      data: {
        responseReceived: { text: answer.text, citations: verified },
        tokensPrompt: answer.tokensPrompt,
        tokensCompletion: answer.tokensCompletion,
        costMicros: answer.costMicros,
        durationMs: Date.now() - started,
      },
    })

    const byId = new Map(gate.sendable.map((c) => [c.id, c]))
    return {
      status: 'JAWABAN',
      answer: answer.text,
      citations: verified.map((id) => {
        const c = byId.get(id)!
        return {
          chunkId: c.id,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          versionLabel: c.versionLabel,
          sectionNo: c.sectionNo,
        }
      }),
      partial: gate.partial,
      // FR-C-013 rule 4 · the source document is the binding reference, and
      // FR-C-014 rule 3 · say so when sources were withheld.
      notice: gate.partial
        ? 'Sebagian sumber tidak disertakan karena klasifikasinya. Dokumen sumber adalah acuan yang mengikat.'
        : 'Dokumen sumber adalah acuan yang mengikat.',
      logId,
    }
  }

  /** FR-C-017 · switch the feature off (or on) immediately. */
  async setEnabled(userId: string, enabled: boolean, reason: string): Promise<void> {
    const row = await this.prisma.llmGatewaySetting.findFirst({ select: { id: true } })
    if (!row) throw new Error('Baris pengaturan gerbang LLM tidak ditemukan.')

    await this.prisma.llmGatewaySetting.update({
      where: { id: row.id },
      data: enabled
        ? { enabled: true, disabledReason: null, disabledBy: null, disabledAt: null }
        : { enabled: false, disabledReason: reason, disabledBy: userId, disabledAt: new Date() },
    })
  }

  async currentSetting() {
    return this.prisma.llmGatewaySetting.findFirst()
  }

  /**
   * Record a refusal and shape the user-facing result.
   *
   * Refusals are logged with the same care as sends. FR-C-016 rule 3 says so,
   * and the reason is that "the gate refused 400 requests this month" is the
   * evidence that the gate works -- a number that does not exist if refusals
   * leave no trace.
   */
  private async refuse(
    logId: string,
    input: AskInput,
    outcome: 'DITOLAK_PEMUTUS' | 'DITOLAK_KLASIFIKASI' | 'DITOLAK_REDAKSI' | 'DITOLAK_BATAS',
    opts: { reason: string; chunks?: readonly Chunk[] },
  ): Promise<AskResult> {
    await this.prisma.llmRequestLog.create({
      data: {
        id: logId,
        askedByUserId: input.askedByUserId,
        questionRaw: input.question,
        outcome,
        refusalReason: opts.reason,
        chunksReferenced: this.chunkSummary(opts.chunks ?? []),
        providerName: this.provider.name,
      },
    })
    return { status: 'TIDAK_TERSEDIA', reason: opts.reason, logId }
  }

  /**
   * What is recorded about each chunk: identity and classification, never the
   * text. The log must show WHAT was referenced and at what sensitivity, and
   * copying restricted document text into a second table would defeat the
   * classification gate by another route.
   */
  private chunkSummary(
    chunks: readonly Chunk[],
  ): { chunk_id: string; document_id: string; classification: Classification }[] {
    return chunks.map((c) => ({
      chunk_id: c.id,
      document_id: c.documentId,
      classification: c.classification,
    }))
  }
}
