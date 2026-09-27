'use client'

import { REVIEW_TEXT } from './text'
import type { DecisionType } from './types'

const OPTIONS: DecisionType[] = ['PERTAHANKAN', 'CABUT', 'UBAH', 'ALIHKAN']

/**
 * The decision control — 06-DESIGN §9.2 rule 2, enforcing U4 and FR-B-012 rule 1.
 *
 * Read the props. There is no `defaultValue`, no `initialValue`, no
 * `fallback`. That absence IS critical control K-2 at the code level: a
 * component that cannot be told what to preselect cannot preselect anything,
 * and no future change adds a default without editing this interface, which is
 * a visible line in a diff rather than a prop passed at one call site.
 *
 * `value` is null for an undecided item and every radio renders unchecked. The
 * only thing that sets it is a reviewer clicking, or a decision they already
 * made and the server returned.
 *
 * FR-B-012's design rationale is the whole reason: if a default exists, most
 * reviewers accept it, and the campaign stops being a control at all.
 */
export function KendaliKeputusan(props: {
  name: string
  value: DecisionType | null
  onChange: (value: DecisionType) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={props.disabled}>
      <legend className="text-sm font-medium text-sg-neutral-900">
        {REVIEW_TEXT.decision.legend}
      </legend>

      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((option, index) => {
          const id = `${props.name}-${option}`
          // Strict equality against a value that starts as null. Never a
          // truthiness check, and never `index === 0`.
          const checked = props.value === option

          return (
            <div key={option}>
              <input
                type="radio"
                id={id}
                name={props.name}
                value={option}
                checked={checked}
                onChange={() => props.onChange(option)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                title={REVIEW_TEXT.decisionMeaning[option]}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-800 hover:bg-sg-neutral-50 peer-checked:border-sg-accent-600 peer-checked:bg-sg-accent-50 peer-checked:font-medium peer-checked:text-sg-accent-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sg-accent-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
              >
                {/* The number is the keyboard shortcut from L-10's keyboard
                    support table, shown rather than documented elsewhere. */}
                <span className="text-xs tabular-nums text-sg-neutral-500">{index + 1}</span>
                {REVIEW_TEXT.decision[option]}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
