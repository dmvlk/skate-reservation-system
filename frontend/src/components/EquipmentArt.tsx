import type { CategoryCode } from '../types'

const ice = '#cfe0f0'
const blue = '#7fb3dc'
const deep = '#1e3a5f'
const accent = '#d94a4a'

export function EquipmentArt({ kind }: { kind: CategoryCode }) {
  return (
    <svg
      className={`equipment-art art-${kind}`}
      viewBox="0 0 360 250"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="186" cy="216" rx="108" ry="13" fill="currentColor" opacity=".08" />

      {kind === 'skates' && (
        <g transform="rotate(-12 180 130)">
          <path
            d="M108 44h66l12 80c5 18 35 24 60 36 17 8 23 22 13 33H105c-23-10-17-28-8-46l11-103Z"
            fill={blue}
            stroke={deep}
            strokeWidth="2"
          />
          <path
            d="m104 112-5 42c-9 17-8 26 5 31h153c-2-9-9-16-24-22l-57-28-72-23Z"
            fill={ice}
          />
          <path
            d="m159 96 28 1m-26 12 29 2m-26 12 30 4m-25 10 32 6m-19 6 29 9"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M121 193v19m110-19v19m-133 0h163c8 0 13-7 13-14"
            stroke={deep}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </g>
      )}

      {kind === 'skis' && (
        <g transform="rotate(24 180 120)">
          <path
            d="M134 19c-13 0-17 14-17 29v160c0 12 5 17 13 17s13-5 13-17V48c0-15 4-29-9-29Z"
            fill={blue}
            stroke={deep}
            strokeWidth="2"
          />
          <path
            d="M181 19c-13 0-17 14-17 29v160c0 12 5 17 13 17s13-5 13-17V48c0-15 4-29-9-29Z"
            fill={blue}
            stroke={deep}
            strokeWidth="2"
          />
          {/* крепления с тёмными полосками */}
          <rect x="121" y="114" width="20" height="40" rx="5" fill={accent} />
          <rect x="168" y="114" width="20" height="40" rx="5" fill={accent} />
          <path d="M125 125h12m35 0h12" stroke={deep} strokeWidth="4" />
          {/* палки */}
          <path
            d="M215 54v150m15-150v150"
            stroke={deep}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* ручки */}
          <path
            d="M215 41v22m15-22v22"
            stroke={accent}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* наконечники: ромб с хвостиком */}
          <path d="m215 206 4 6-4 6-4-6 4-6Z" fill={accent} />
          <path d="m230 206 4 6-4 6-4-6 4-6Z" fill={accent} />
          <path
            d="M215 218v4m15-4v4"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}

      {kind === 'snowboard' && (
        <g transform="rotate(28 180 125)">
          <rect
            x="152"
            y="15"
            width="56"
            height="220"
            rx="28"
            fill={blue}
            stroke={deep}
            strokeWidth="3"
          />
          {/* крепления с тёмными полосками */}
          <rect x="162" y="80" width="36" height="30" rx="6" fill={accent} />
          <rect x="162" y="146" width="36" height="30" rx="6" fill={accent} />
          <path
            d="M168 95h24M168 161h24"
            stroke={deep}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  )
}