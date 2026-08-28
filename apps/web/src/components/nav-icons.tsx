import type { SVGProps } from 'react'

/**
 * A tiny inline icon set for navigation, drawn as 1.5px-stroke line icons to sit
 * quietly beside a label (06-DESIGN §5: icons are labelled, never alone). Inline
 * SVG rather than an icon dependency keeps the bundle small and the stroke
 * consistent with the calm, dense chrome.
 *
 * `currentColor` so each icon inherits the link's text colour, including the
 * active-state accent.
 */
export type IconName =
  | 'home'
  | 'clipboard-check'
  | 'layers'
  | 'ticket'
  | 'grid'
  | 'upload'
  | 'shield'

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function NavIcon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  switch (name) {
    case 'home':
      return (
        <svg {...base(props)}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      )
    case 'clipboard-check':
      return (
        <svg {...base(props)}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path d="m9.5 13 2 2 3.5-4" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...base(props)}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      )
    case 'ticket':
      return (
        <svg {...base(props)}>
          <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
          <path d="M14 6v12" strokeDasharray="2 2" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...base(props)}>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...base(props)}>
          <path d="M12 15V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...base(props)}>
          <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
          <path d="m9.5 12 2 2 3-3.5" />
        </svg>
      )
    default:
      return null
  }
}
