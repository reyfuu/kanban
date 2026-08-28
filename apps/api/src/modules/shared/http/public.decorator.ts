import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC = 'sigap:is-public'

/**
 * Marks a route as reachable without authentication.
 *
 * Opt-out rather than opt-in: the guard protects everything by default, so a
 * new endpoint is protected because nobody did anything, and exposing one is a
 * visible line in the diff. The reverse arrangement fails silently.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true)
