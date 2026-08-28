import { Injectable } from '@nestjs/common'
import type { Classification } from '@prisma/client'
import {
  LlmGatewayService,
  type AskResult,
  type Chunk,
  type Principal,
} from '../shared/index.js'
import { DocumentSearchRepository } from './document-search.repository.js'

/** Statuses whose text may be quoted back at someone as current policy. */
const ANSWERABLE_STATUSES = ['BERLAKU'] as const

/**
 * FR-C-013 · answers formed from policy documents.
 *
 * This is the retrieval half; every control lives in the gateway, and this
 * class deliberately owns none of them. That split is the point of ADR-03: if
 * the answer feature could decide for itself what to send, the gate would be
 * one caller's discipline rather than a structural property.
 *
 * Two retrieval decisions carry meaning of their own.
 *
 * ONLY DOCUMENTS IN FORCE. Rule 4 says the source document is the binding
 * reference, which only holds if the source is currently in force. Answering
 * from a superseded SOP would tell someone, with a citation, to follow a
 * procedure the company has replaced -- worse than not answering, because the
 * citation makes it credible.
 *
 * A RELEVANCE FLOOR. Rule 5 requires the system to say it found no adequate
 * basis rather than assemble an answer from weak matches. A model handed
 * marginal context will still produce fluent prose, and fluent prose with a
 * citation is exactly what a reader stops questioning.
 */
@Injectable()
export class DocumentAnswerService {
  /**
   * Below this ts_rank_cd score a chunk is not evidence of anything. Applied
   * to the best hit: if even the strongest match is weak, the question is not
   * answerable from policy, and that is a legitimate and useful reply.
   */
  private static readonly RELEVANCE_FLOOR = 0.02

  constructor(
    private readonly repo: DocumentSearchRepository,
    private readonly gateway: LlmGatewayService,
  ) {}

  async answer(principal: Principal, question: string): Promise<AskResult> {
    const rows = await this.repo.chunksForAnswer({
      userId: principal.userId,
      query: question,
      statuses: ANSWERABLE_STATUSES,
      limit: 8,
    })

    // Rule 5 · no adequate basis. Reported without ever calling the gateway,
    // because there is nothing to send: a request that was never made should
    // not appear in the gateway log as a refusal by the gate.
    const best = rows[0]?.score ?? 0
    if (rows.length === 0 || best < DocumentAnswerService.RELEVANCE_FLOOR) {
      return {
        status: 'TIDAK_TERSEDIA',
        reason:
          'Tidak ditemukan dasar yang memadai di dokumen kebijakan. Gunakan hasil pencarian dokumen.',
        logId: '',
      }
    }

    const chunks: Chunk[] = rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      versionLabel: `${r.version_major}.${r.version_minor}`,
      sectionNo: r.section_ref ?? '-',
      text: r.content,
      classification: r.classification as Classification,
    }))

    return this.gateway.ask({
      askedByUserId: principal.userId,
      question,
      chunks,
    })
  }
}
