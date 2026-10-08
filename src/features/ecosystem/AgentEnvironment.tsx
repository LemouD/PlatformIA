import type { CSSProperties } from 'react'
import { useId } from 'react'
import { STATUS_META } from '@/design/status'
import type { AgentStatus, EnvironmentKind } from '@/domain/types'

interface AgentEnvironmentProps {
  environment: EnvironmentKind
  status: AgentStatus
  showScene: boolean
  className?: string
}

const STATE_VAR = 'var(--agent-state)'
const BRASS = '#C9A46A'

/** Floor and scene objects of a territory, drawn in a 200 × 130 box (design reference: agent-environments.svg). */
export function AgentEnvironment({ environment, status, showScene, className }: AgentEnvironmentProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gid = (name: string) => `${uid}-${name}`
  const fill = (name: string) => `url(#${gid(name)})`
  const poolOpacity = status === 'IDLE' ? 0.18 : 0.32

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 200 130"
      fill="none"
      className={className}
      style={{ '--agent-state': STATUS_META[status].color, overflow: 'visible' } as CSSProperties}
    >
      <defs>
        <linearGradient id={gid('brass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1D3A1" />
          <stop offset=".55" stopColor="#B08546" />
          <stop offset="1" stopColor="#5A3B1A" />
        </linearGradient>
        <linearGradient id={gid('wood')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A1A2C" />
          <stop offset="1" stopColor="#1C0811" />
        </linearGradient>
        <radialGradient id={gid('glow')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FFF4DC" />
          <stop offset=".4" style={{ stopColor: STATE_VAR }} />
          <stop offset="1" style={{ stopColor: STATE_VAR }} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gid('floor')} cx=".5" cy=".5" r=".5">
          <stop offset="0" style={{ stopColor: 'var(--color-velvet)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-surface)' }} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g data-part="env-floor">
        <ellipse cx="100" cy="96" rx="96" ry="30" fill={fill('floor')} />
        <ellipse cx="100" cy="96" rx="92" ry="27" stroke={BRASS} strokeOpacity=".25" />
        <ellipse cx="100" cy="96" rx="50" ry="12" fill={fill('glow')} opacity={poolOpacity} />
      </g>

      {showScene && environment === 'research' ? (
        <g data-part="env-research">
          <path d="M40 40 L72 30 L76 44 L44 54Z" fill="#2B0D22" stroke={fill('brass')} strokeWidth="1.5" />
          <path d="M46 44 Q58 36 70 36 M46 48 Q58 40 72 40" stroke="#F2E6D8" strokeOpacity=".7" />
          <path d="M60 50 L60 92 M50 92 L70 92" stroke={BRASS} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="120" y="78" width="40" height="7" rx="1" fill="#5B2240" />
          <rect x="124" y="71" width="34" height="7" rx="1" fill="#2B0D22" stroke={BRASS} strokeOpacity=".4" />
          <rect x="118" y="85" width="44" height="8" rx="1" style={{ fill: 'var(--color-velvet)' }} />
          <path d="M150 71 L150 48" stroke={BRASS} strokeWidth="2" />
          <path d="M140 52 L160 52 L156 42 L144 42Z" fill="#2B0D22" stroke={fill('brass')} />
          <circle cx="150" cy="55" r="9" fill={fill('glow')} />
        </g>
      ) : null}

      {showScene && environment === 'coding' ? (
        <g data-part="env-coding">
          <rect x="30" y="62" width="110" height="8" rx="2" fill={fill('wood')} stroke={BRASS} strokeOpacity=".35" />
          <path d="M38 70 L38 96 M132 70 L132 96" stroke="#4A1A2C" strokeWidth="4" strokeLinecap="round" />
          <path d="M60 62 L64 46 L106 46 L110 62Z" fill="#14060F" stroke={fill('brass')} strokeWidth="1.5" />
          <rect x="70" y="30" width="30" height="18" fill="#F2E6D8" opacity=".85" />
          <path d="M74 36 h18 M74 41 h12" stroke="#5A3B1A" strokeWidth="1.2" />
          <g fill={BRASS}>
            <circle cx="72" cy="56" r="1.6" />
            <circle cx="79" cy="56" r="1.6" />
            <circle cx="86" cy="56" r="1.6" />
            <circle cx="93" cy="56" r="1.6" />
            <circle cx="100" cy="56" r="1.6" />
          </g>
          <path d="M128 62 L128 46" stroke={BRASS} strokeWidth="2" />
          <path d="M116 46 Q128 34 140 46Z" fill="#2B0D22" stroke={fill('brass')} />
          <circle cx="128" cy="48" r="9" fill={fill('glow')} />
        </g>
      ) : null}

      {showScene && environment === 'home' ? (
        <g data-part="env-home">
          <rect x="40" y="10" width="34" height="88" rx="4" fill={fill('wood')} stroke={fill('brass')} strokeWidth="1.5" />
          <path d="M40 18 Q57 0 74 18" fill="#2B0D22" stroke={fill('brass')} strokeWidth="1.5" />
          <circle cx="57" cy="30" r="11" style={{ fill: 'var(--color-screen)' }} stroke={fill('brass')} strokeWidth="2" />
          <circle cx="57" cy="30" r="9" fill={fill('glow')} opacity=".6" />
          <path d="M57 30 L57 23 M57 30 L62 32" stroke="#F2E6D8" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="48" y="48" width="18" height="40" rx="2" style={{ fill: 'var(--color-screen)' }} stroke={BRASS} strokeOpacity=".3" />
          <path d="M57 50 L57 78" stroke={BRASS} />
          <circle cx="57" cy="80" r="4" fill={fill('brass')} />
          <path d="M150 98 L150 34 M140 98 L160 98" stroke={BRASS} strokeWidth="2" strokeLinecap="round" />
          <path d="M136 36 L164 36 L158 18 L142 18Z" style={{ fill: 'var(--color-velvet)' }} stroke={fill('brass')} />
          <circle cx="150" cy="40" r="11" fill={fill('glow')} />
        </g>
      ) : null}

      {showScene && environment === 'personal' ? (
        <g data-part="env-personal">
          <rect x="44" y="64" width="112" height="9" rx="2" fill={fill('wood')} stroke={BRASS} strokeOpacity=".35" />
          <path d="M54 73 Q50 86 56 98 M146 73 Q150 86 144 98" stroke="#4A1A2C" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="100" cy="34" rx="22" ry="28" style={{ fill: 'var(--color-screen)' }} stroke={fill('brass')} strokeWidth="2.5" />
          <ellipse cx="100" cy="34" rx="18" ry="24" fill={fill('glow')} opacity=".35" />
          <path d="M90 22 Q94 16 100 15" stroke="#FFF4DC" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M136 64 Q132 54 138 48 L144 48 Q150 54 146 64Z" fill="#2B0D22" stroke={fill('brass')} />
          <path d="M141 48 Q140 38 146 32 M141 48 Q136 40 132 38" stroke="#6B5A3A" strokeWidth="1.5" />
          <circle cx="146" cy="31" r="4" fill="#F2E6D8" />
          <circle cx="131" cy="37" r="3" fill="#F2E6D8" opacity=".85" />
        </g>
      ) : null}

      {showScene && environment === 'generic' ? (
        <g data-part="env-generic">
          <ellipse cx="100" cy="60" rx="30" ry="6" fill={fill('wood')} stroke={fill('brass')} strokeWidth="1.5" />
          <path d="M100 66 L100 94 M88 98 L100 92 L112 98" stroke={BRASS} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="96" y="46" width="8" height="12" rx="1" fill="#F2E6D8" opacity=".85" />
          <path d="M92 58 h16" stroke={BRASS} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="40" r="10" fill={fill('glow')} />
          <path d="M100 44 q-3 -5 0 -9 q3 4 0 9Z" fill="#FFF4DC" />
        </g>
      ) : null}
    </svg>
  )
}
