import type { CategoryCode } from '../types'

// Local vector illustrations: no image service or external assets needed.
export function EquipmentArt({ kind }: { kind: CategoryCode }) {
  return (
    <svg
      className={`equipment-art art-${kind}`}
      viewBox="0 0 360 250"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="186" cy="216" rx="108" ry="13" fill="currentColor" opacity=".08" />
      {kind === 'skates' ? (
        <g transform="rotate(-12 180 130)">
          <path
            d="M108 44h66l12 80c5 18 35 24 60 36 17 8 23 22 13 33H105c-23-10-17-28-8-46l11-103Z"
            fill="#f9fbf8"
            stroke="#b1c4bc"
            strokeWidth="2"
          />
          <path d="m108 44-6 53h76l-4-53h-66Z" fill="#2d5149" />
          <path
            d="m104 112-5 42c-9 17-8 26 5 31h153c-2-9-9-16-24-22l-57-28-72-23Z"
            fill="#d7e2d6"
          />
          <path
            d="m159 96 28 1m-26 12 29 2m-26 12 30 4m-25 10 32 6m-19 6 29 9"
            stroke="#78948a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M121 193v19m110-19v19m-133 0h163c8 0 13-7 13-14"
            stroke="#647c79"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M109 58h49" stroke="#c2d794" strokeWidth="5" strokeLinecap="round" />
          <path d="m119 119 17 10-4 27-17-9 4-28Z" fill="#91ad9d" />
        </g>
      ) : kind === 'skis' ? (
        <g transform="rotate(24 180 120)">
          <path
            d="M134 19c-13 0-17 14-17 29v160c0 12 5 17 13 17s13-5 13-17V48c0-15 4-29-9-29Z"
            fill="#31564b"
          />
          <path
            d="M181 19c-13 0-17 14-17 29v160c0 12 5 17 13 17s13-5 13-17V48c0-15 4-29-9-29Z"
            fill="#446a5a"
          />
          <path d="m118 62 25 20v22l-25-20V62Zm47 0 25 20v22l-25-20V62Z" fill="#c8dc9c" />
          <path d="M121 171h19v17h-19zm47 0h19v17h-19z" fill="#dce8d8" />
          <rect x="121" y="114" width="20" height="40" rx="5" fill="#132f2c" />
          <rect x="168" y="114" width="20" height="40" rx="5" fill="#132f2c" />
          <path d="M125 125h12m35 0h12" stroke="#dce8d8" strokeWidth="5" />
          <path d="M215 54v157m15-157v157" stroke="#71857b" strokeWidth="3" />
          <path d="M215 41v22m15-22v22" stroke="#233c35" strokeWidth="7" strokeLinecap="round" />
          <path d="M207 198h16m-1 7h16" stroke="#233c35" strokeWidth="3" />
        </g>
      ) : (
        <g transform="rotate(28 180 125)">
          <rect
            x="131"
            y="15"
            width="94"
            height="220"
            rx="44"
            fill="#d8e5bd"
            stroke="#b3c699"
            strokeWidth="2"
          />
          <path d="m132 150 93-70v40l-93 70v-40Z" fill="#3b5f50" />
          <path d="m132 178 93-70v12l-93 70v-12Z" fill="#243f37" />
          <path d="m157 51 20-15 22 15-22 17-20-17Z" stroke="#6b8761" strokeWidth="2" />
          <g transform="rotate(-18 178 92)">
            <rect x="155" y="70" width="45" height="43" rx="11" fill="#233f36" />
            <path d="M159 78h37v21h-37z" fill="#719079" />
            <path d="M161 86h33" stroke="#c8d8b9" strokeWidth="5" />
          </g>
          <g transform="rotate(18 178 167)">
            <rect x="155" y="145" width="45" height="43" rx="11" fill="#233f36" />
            <path d="M159 153h37v21h-37z" fill="#719079" />
            <path d="M161 161h33" stroke="#c8d8b9" strokeWidth="5" />
          </g>
          <path d="M166 212h24" stroke="#6b8761" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
