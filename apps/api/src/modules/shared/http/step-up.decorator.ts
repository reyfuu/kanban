import { SetMetadata } from '@nestjs/common'

export const REQUIRES_STEP_UP = 'sigap:requires-step-up'

/**
 * Marks a route as requiring re-authentication (FR-X-003).
 *
 * FR-X-003 lists the actions by name: campaign sign-off, document ratification,
 * evidence deletion, legal hold, changing another user's roles, and toggling
 * the LLM gate. Adding this decorator is how a route joins that list -- and
 * removing it is a visible line in a diff, which is the point.
 */
export const RequiresStepUp = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_STEP_UP, true)
