/**
 * ADR-03 K9 · provider independence (FR-C-018).
 *
 * The application never names a vendor. It talks to this interface, and which
 * implementation is bound is a configuration choice made once, in the module.
 * FR-C-018 rule 1 requires switching providers -- or moving to a model running
 * inside the company's own data centre -- to be a configuration change and not
 * a code change, and an interface is the only way that promise survives contact
 * with a second provider.
 *
 * FR-C-018 rule 2 requires the system to run fully with answer generation
 * switched off. That is why the null implementation below is a real, supported
 * mode rather than a test double: a deployment with no provider configured is a
 * correct deployment, not a broken one.
 */

export interface LlmPrompt {
  readonly question: string
  /** Redacted, classification-gated context. Nothing else may be sent. */
  readonly context: readonly {
    readonly ref: string
    readonly text: string
  }[]
}

export interface LlmAnswer {
  readonly text: string
  /** Chunk refs the provider claims to have used. Verified by the gateway. */
  readonly citations: readonly string[]
  readonly tokensPrompt: number
  readonly tokensCompletion: number
  readonly costMicros: bigint
}

export abstract class LlmProvider {
  abstract readonly name: string
  abstract generate(prompt: LlmPrompt): Promise<LlmAnswer>
}

/**
 * The provider used when none is configured.
 *
 * It refuses rather than returning an empty answer. An empty answer would flow
 * through the rest of the gateway, fail the citation check, and be logged as
 * DITOLAK_TANPA_RUJUKAN -- which would tell an operator that the model returned
 * something unusable, when in fact no model was ever called. Refusing keeps the
 * log honest about what actually happened.
 */
export class UnconfiguredLlmProvider extends LlmProvider {
  readonly name = 'TIDAK_DIKONFIGURASI'

  generate(): Promise<LlmAnswer> {
    return Promise.reject(
      new Error('Penyedia layanan bahasa belum dikonfigurasi pada penempatan ini.'),
    )
  }
}
