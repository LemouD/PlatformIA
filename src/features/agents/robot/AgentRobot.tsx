'use client'

import { motion, useAnimate, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useEffect, useId } from 'react'
import { STATUS_META } from '@/design/status'
import type { AgentStatus, AgentType, EnvironmentKind } from '@/domain/types'
import { resolveRobotProp, ROBOT_VIEWBOX, robotHeight, SPRING_A, STATE_MOTION } from './robot-model'

export interface AgentRobotProps {
  status: AgentStatus
  environment: EnvironmentKind
  role: AgentType
  variant: 'world' | 'specimen'
  facing: 'left' | 'right'
  moving: boolean
  /** Task progress between 0 and 1, shown on the status bar under the visor. */
  progress?: number
  /** Orbit scale, applied to world robots only. */
  scale?: number
  /** Explicit height in px, e.g. the 50 px miniature of the phone agent list. */
  size?: number
}

const STATE_VAR = 'var(--agent-state)'
const BRASS = '#C9A46A'
const SPRING_B = { type: 'spring', stiffness: 180, damping: 9, mass: 1 } as const

/** Pivot expressed in the 240 × 300 viewBox, as given by the design reference. */
function origin(x: number, y: number): CSSProperties {
  return { transformBox: 'view-box', transformOrigin: `${x}px ${y}px` }
}

function loop(duration: number) {
  return { duration, repeat: Infinity, ease: 'easeInOut' } as const
}

const TENDRILS = [
  { part: 'tendril-1', d: 'M100 212 q-8 22 2 46', x: 100, y: 212, period: 4 },
  { part: 'tendril-2', d: 'M120 216 q5 24 -2 50', x: 120, y: 216, period: 5 },
  { part: 'tendril-3', d: 'M140 212 q8 20 -2 42', x: 140, y: 212, period: 4.4 },
] as const

function statusBarProgress(status: AgentStatus, variant: 'world' | 'specimen', progress?: number): number {
  if (status === 'IDLE') return 0
  if (status === 'COMPLETED') return 1
  if (variant === 'specimen') return status === 'WORKING' ? 2 / 3 : 0
  return Math.min(1, Math.max(0, progress ?? 0))
}

export function AgentRobot({
  status,
  environment,
  role,
  variant,
  facing,
  moving,
  progress,
  scale = 1,
  size,
}: AgentRobotProps) {
  const reduced = useReducedMotion() ?? false
  const live = variant === 'world' && !reduced
  const rhythm = STATE_MOTION[status]
  const prop = resolveRobotProp(role, environment)
  const height = size ?? robotHeight(variant, role, scale)
  const width = (height * ROBOT_VIEWBOX.width) / ROBOT_VIEWBOX.height

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gid = (name: string) => `${uid}-${name}`
  const fill = (name: string) => `url(#${gid(name)})`

  const [scope, animate] = useAnimate<SVGSVGElement>()

  useEffect(() => {
    if (!live || !rhythm.blinks) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      timer = setTimeout(
        () => {
          void animate('[data-part="eyes"]', { scaleY: [1, 0.1, 1] }, { duration: 0.16 })
          schedule()
        },
        3000 + Math.random() * 4000,
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [animate, live, rhythm.blinks])

  const floats = live && rhythm.floats
  const errored = rhythm.pose === 'antenna-bent'
  const trayOut = rhythm.pose === 'tray'
  const salute = rhythm.pose === 'salute'
  const fadeFace = { duration: live ? 0.2 : 0 }

  const heartbeat = rhythm.irregular
    ? {
        animate: { scale: [1, 0.85, 1, 0.92, 1] },
        transition: { duration: rhythm.heartbeat, times: [0, 0.2, 0.35, 0.6, 1], repeat: Infinity },
      }
    : { animate: { scale: [1, 0.88, 1] }, transition: loop(rhythm.heartbeat) }

  const flicker = {
    duration: 1.4,
    times: [0, 0.2, 0.24, 0.6, 0.63],
    repeat: Infinity,
  }

  return (
    <svg
      ref={scope}
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${ROBOT_VIEWBOX.width} ${ROBOT_VIEWBOX.height}`}
      width={width}
      height={height}
      fill="none"
      style={{ '--agent-state': STATUS_META[status].color, overflow: 'visible' } as CSSProperties}
    >
      <defs>
        <linearGradient id={gid('lacquer')} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#5B2240" />
          <stop offset=".5" stopColor="#2B0D22" />
          <stop offset="1" stopColor="#14060F" />
        </linearGradient>
        <linearGradient id={gid('brass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1D3A1" />
          <stop offset=".55" stopColor="#B08546" />
          <stop offset="1" stopColor="#5A3B1A" />
        </linearGradient>
        <linearGradient id={gid('glass')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F2E6D8" stopOpacity=".05" />
          <stop offset=".3" stopColor="#F2E6D8" stopOpacity=".2" />
          <stop offset="1" stopColor="#F2E6D8" stopOpacity=".04" />
        </linearGradient>
        <linearGradient id={gid('rim-light')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: STATE_VAR }} />
          <stop offset=".6" style={{ stopColor: STATE_VAR }} stopOpacity=".15" />
          <stop offset="1" style={{ stopColor: STATE_VAR }} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={gid('core-light')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FFF4DC" />
          <stop offset=".45" style={{ stopColor: STATE_VAR }} />
          <stop offset="1" style={{ stopColor: STATE_VAR }} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid('screen-lacquer')} x1="0" y1="0" x2=".25" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-lacquer-light)' }} />
          <stop offset=".55" style={{ stopColor: 'var(--color-lacquer)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-screen)' }} />
        </linearGradient>
        <radialGradient id={gid('antenna-glow')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FFF4DC" />
          <stop offset=".5" style={{ stopColor: STATE_VAR }} />
          <stop offset="1" style={{ stopColor: STATE_VAR }} stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.g
        data-part="robot"
        style={origin(120, 150)}
        initial={false}
        animate={{
          scaleX: facing === 'left' ? -1 : 1,
          x: errored && live ? [0, -6, 6, -3, 3, 0] : 0,
        }}
        transition={{
          scaleX: { duration: live ? 0.26 : 0, ease: 'easeInOut' },
          x: { duration: errored && live ? 0.5 : 0, ease: 'easeOut' },
        }}
      >
        <motion.ellipse
          data-part="shadow"
          cx="120"
          cy="272"
          rx="34"
          ry="5"
          fill="#050103"
          style={origin(120, 272)}
          initial={false}
          animate={floats ? { scaleX: [1, 0.82, 1], opacity: [0.7, 0.45, 0.7] } : { scaleX: 1, opacity: 0.7 }}
          transition={floats ? loop(moving ? 2.5 : 5) : { duration: 0.4 }}
        />

        <motion.g
          data-part="body"
          style={origin(120, 216)}
          initial={false}
          animate={floats ? { y: moving ? [0, -3, 0] : [0, -6, 0], rotate: moving ? 4 : 0 } : { y: 0, rotate: 0 }}
          transition={floats ? { y: loop(moving ? 2.5 : 5), rotate: SPRING_A } : { duration: 0.4 }}
        >
          <g data-part="tendrils" stroke={BRASS} strokeWidth="1.6" strokeLinecap="round" opacity=".8">
            {TENDRILS.map((tendril) => (
              <motion.path
                key={tendril.part}
                data-part={tendril.part}
                d={tendril.d}
                style={origin(tendril.x, tendril.y)}
                initial={false}
                animate={live ? { rotate: moving ? [-14, -2, -14] : [-6, 6, -6] } : { rotate: 0 }}
                transition={live ? loop(tendril.period) : { duration: 0 }}
              />
            ))}
          </g>

          {prop !== 'orchestrator' ? (
            <g data-part="arm-left">
              <path d="M80 140 Q68 162 74 184" stroke={fill('brass')} strokeWidth="3" strokeLinecap="round" />
              <circle cx="74" cy="185" r="3" fill={BRASS} />
            </g>
          ) : null}

          <motion.g
            data-part="arm-right"
            initial={false}
            animate={{ opacity: trayOut ? 0 : 1 }}
            transition={{ duration: 0.12 }}
          >
            <path d="M160 140 Q172 160 166 184" stroke={fill('brass')} strokeWidth="3" strokeLinecap="round" />
            <circle cx="166" cy="185" r="3" fill={BRASS} />
          </motion.g>

          <motion.g
            data-part="tray"
            style={origin(160, 142)}
            initial={false}
            animate={trayOut ? { rotate: 0, opacity: 1 } : { rotate: 80, opacity: 0 }}
            transition={live ? { rotate: SPRING_A, opacity: { duration: 0.2 } } : { duration: 0 }}
          >
            <path d="M160 142 L188 150" stroke={fill('brass')} strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="200" cy="151" rx="17" ry="3.5" fill={fill('brass')} />
            <motion.g
              data-part="tray-card"
              initial={false}
              animate={trayOut && live ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
              transition={trayOut && live ? loop(rhythm.heartbeat) : { duration: 0 }}
            >
              <rect x="193" y="139" width="14" height="10" rx="1.5" fill="#F2E6D8" />
              <circle cx="200" cy="144" r="2" style={{ fill: STATE_VAR }} />
            </motion.g>
          </motion.g>

          <g data-part="bell">
            <path d="M80 128 Q120 116 160 128 C176 164 170 210 120 216 C70 210 64 164 80 128Z" fill={fill('glass')} />
            <path
              data-part="rim"
              d="M80 128 Q120 116 160 128 C176 164 170 210 120 216 C70 210 64 164 80 128Z"
              stroke={fill('rim-light')}
              strokeWidth="2"
            />
            <path
              data-part="bell-highlight"
              d="M88 142 C84 162 86 184 96 200"
              stroke="#FFF4DC"
              strokeOpacity=".45"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          <motion.circle
            data-part="core"
            cx="120"
            cy="170"
            r="28"
            fill={fill('core-light')}
            style={origin(120, 170)}
            initial={false}
            animate={live ? heartbeat.animate : { scale: 1 }}
            transition={live ? heartbeat.transition : { duration: 0 }}
          />

          <motion.g
            data-part="upper"
            style={origin(120, 130)}
            initial={false}
            animate={{ rotate: salute ? (live ? [0, 20, 20, 0] : 12) : 0 }}
            transition={salute && live ? { duration: 1.2, times: [0, 0.3, 0.6, 1] } : { duration: 0 }}
          >
            <ellipse data-part="collar" cx="120" cy="128" rx="41" ry="6" fill={fill('brass')} />
            <path data-part="bowtie" d="M107 121 l13 7 l13 -7 v13 l-13 -6 l-13 6Z" fill={BRASS} />
            <rect data-part="neck" x="112" y="106" width="16" height="16" fill="#14060F" />

            <motion.g
              data-part="antenna"
              style={origin(120, 44)}
              initial={false}
              animate={{ rotate: errored ? 38 : 0 }}
              transition={live ? (errored ? { ...SPRING_B, delay: 0.12 } : SPRING_A) : { duration: 0 }}
            >
              {/* Solid brass: a gradient on a perfectly vertical stroke has a zero-width box and does not render. */}
              <path d="M120 44 L120 24" stroke={BRASS} strokeWidth="3" strokeLinecap="round" />
              <motion.circle
                data-part="antenna-ball"
                cx="120"
                cy="20"
                r="9"
                fill={fill('antenna-glow')}
                initial={false}
                animate={
                  !live ? { opacity: 1 } : errored ? { opacity: [1, 0.3, 1, 0.5, 1] } : { opacity: [1, 0.45, 1] }
                }
                transition={!live ? { duration: 0 } : errored ? flicker : loop(rhythm.heartbeat)}
              />
              <circle cx="120" cy="20" r="4.5" fill="#FFF4DC" />
            </motion.g>

            <g data-part="head">
              <rect
                data-part="head-shell"
                x="80"
                y="42"
                width="80"
                height="70"
                rx="22"
                fill={fill('screen-lacquer')}
                stroke={BRASS}
                strokeOpacity=".55"
                strokeWidth="1.5"
              />
              <path
                data-part="head-highlight"
                d="M90 50 Q100 45 116 45"
                stroke="#F2E6D8"
                strokeOpacity=".25"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <motion.rect
                data-part="visor"
                x="90"
                y="54"
                width="60"
                height="36"
                rx="11"
                style={{ fill: 'var(--color-screen)' }}
                stroke={BRASS}
                strokeOpacity=".35"
                initial={false}
                animate={errored && live ? { opacity: [1, 0.6, 1, 0.8, 1] } : { opacity: 1 }}
                transition={errored && live ? flicker : { duration: 0 }}
              />

              <motion.g
                data-part="face-idle"
                style={{ fill: STATE_VAR }}
                initial={false}
                animate={{ opacity: status === 'IDLE' ? 1 : 0 }}
                transition={fadeFace}
              >
                <g data-part="eyes">
                  <rect x="104" y="63" width="6" height="11" rx="1.6" />
                  <rect x="130" y="63" width="6" height="11" rx="1.6" />
                </g>
                <rect x="113" y="80" width="14" height="2.4" rx="1.2" />
              </motion.g>

              <motion.g
                data-part="face-thinking"
                style={{ fill: STATE_VAR }}
                initial={false}
                animate={{ opacity: status === 'THINKING' ? 1 : 0 }}
                transition={fadeFace}
              >
                <rect x="103" y="65" width="8" height="2.6" rx="1.3" />
                <rect x="129" y="63" width="8" height="2.6" rx="1.3" />
                {[113, 120, 127].map((cx, index) => (
                  <motion.circle
                    key={cx}
                    cx={cx}
                    cy="81"
                    r="1.6"
                    initial={false}
                    animate={status === 'THINKING' && live ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
                    transition={
                      status === 'THINKING' && live
                        ? { duration: 1.2, repeat: Infinity, delay: index * 0.4, ease: 'easeInOut' }
                        : { duration: 0 }
                    }
                  />
                ))}
              </motion.g>

              <motion.g
                data-part="face-working"
                style={{ fill: STATE_VAR }}
                initial={false}
                animate={{ opacity: status === 'WORKING' ? 1 : 0 }}
                transition={fadeFace}
              >
                <g data-part="eyes">
                  <rect x="104" y="65" width="6" height="8" rx="1.6" />
                  <rect x="130" y="65" width="6" height="8" rx="1.6" />
                </g>
                <rect x="113" y="80" width="14" height="2.4" rx="1.2" />
              </motion.g>

              <motion.g
                data-part="face-waiting"
                style={{ fill: STATE_VAR }}
                initial={false}
                animate={{ opacity: status === 'WAITING_APPROVAL' ? 1 : 0 }}
                transition={fadeFace}
              >
                <g data-part="eyes">
                  <rect x="108" y="63" width="6" height="11" rx="1.6" />
                  <rect x="134" y="63" width="6" height="11" rx="1.6" />
                </g>
                <circle cx="122" cy="81" r="2.6" />
              </motion.g>

              <motion.g
                data-part="face-error"
                style={{ stroke: STATE_VAR }}
                strokeWidth="2.4"
                strokeLinecap="round"
                initial={false}
                animate={{ opacity: status === 'ERROR' ? 1 : 0 }}
                transition={fadeFace}
              >
                <path d="M102 63 l8 9 M110 63 l-8 9 M128 63 l8 9 M136 63 l-8 9" />
                <path d="M112 83 q8 -5 16 0" />
              </motion.g>

              <motion.g
                data-part="face-completed"
                style={{ stroke: STATE_VAR }}
                strokeWidth="2.4"
                strokeLinecap="round"
                initial={false}
                animate={{ opacity: status === 'COMPLETED' ? 1 : 0 }}
                transition={fadeFace}
              >
                <path d="M102 70 q4 -6 8 0 M128 70 q4 -6 8 0" />
                <path d="M112 79 q8 6 16 0" />
              </motion.g>

              <g data-part="status-bar">
                <rect x="98" y="95" width="44" height="4" rx="2" style={{ fill: 'var(--color-screen)' }} />
                <motion.rect
                  data-part="status-bar-fill"
                  x="98"
                  y="95"
                  width="44"
                  height="4"
                  rx="2"
                  style={{ ...origin(98, 97), fill: STATE_VAR }}
                  initial={false}
                  animate={{ scaleX: statusBarProgress(status, variant, progress) }}
                  transition={{ duration: live ? 0.4 : 0, ease: 'easeOut' }}
                />
              </g>
            </g>
          </motion.g>

          {prop === 'research' ? (
            <g data-part="prop-research">
              <path d="M74 186 L66 198" stroke="#5A3B1A" strokeWidth="5" strokeLinecap="round" />
              <circle cx="58" cy="210" r="12" fill="#F2E6D8" fillOpacity=".12" stroke={fill('brass')} strokeWidth="3" />
              <path d="M52 205 q4 -4 9 -2" stroke="#FFF4DC" strokeWidth="1.6" opacity=".7" />
            </g>
          ) : null}

          {prop === 'coding' ? (
            <g data-part="prop-coding">
              {/* Counter-flipped so the </> badge stays readable when the robot faces left. */}
              <motion.g
                data-part="coding-badge"
                stroke={BRASS}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={origin(120, 48.5)}
                initial={false}
                animate={{ scaleX: facing === 'left' ? -1 : 1 }}
                transition={{ duration: live ? 0.26 : 0, ease: 'easeInOut' }}
              >
                <path d="M112 46 l-3 2.5 l3 2.5" />
                <path d="M128 46 l3 2.5 l-3 2.5" />
                <path d="M122 45 l-4 7" />
              </motion.g>
              <path d="M74 186 L64 204" stroke={fill('brass')} strokeWidth="4" strokeLinecap="round" />
              <path d="M58 202 a8 8 0 1 0 11 8 l-5 -1 l-1 -5Z" fill={fill('brass')} />
            </g>
          ) : null}

          {prop === 'home' ? (
            <g data-part="prop-home">
              <circle cx="74" cy="193" r="6" stroke={fill('brass')} strokeWidth="2.5" />
              <circle cx="74" cy="207" r="5" stroke={fill('brass')} strokeWidth="2.5" />
              <rect x="72.5" y="212" width="3" height="20" fill={BRASS} />
              <rect x="75.5" y="224" width="6" height="2.5" fill={BRASS} />
              <rect x="75.5" y="229" width="4" height="2.5" fill={BRASS} />
            </g>
          ) : null}

          {prop === 'personal' ? (
            <g data-part="prop-personal">
              <path d="M92 130 q-6 10 -4 18" stroke="#5A3B1A" strokeWidth="2" />
              <path d="M90 140 q-10 -2 -12 6 q8 2 12 -6Z" fill="#6B5A3A" />
              <g fill="#F2E6D8">
                <circle cx="92" cy="124" r="8" opacity=".9" />
                <circle cx="86" cy="120" r="5" />
                <circle cx="98" cy="119" r="5" />
                <circle cx="92" cy="128" r="5" opacity=".8" />
              </g>
              <circle cx="92" cy="123" r="3" fill="#E9CFC4" />
            </g>
          ) : null}

          {prop === 'orchestrator' ? (
            <g data-part="prop-orchestrator">
              <path d="M80 140 Q64 128 58 108" stroke={fill('brass')} strokeWidth="3" strokeLinecap="round" />
              <circle cx="58" cy="107" r="3" fill={BRASS} />
              <g data-part="baton">
                <path d="M58 107 L36 76" stroke="#F2E6D8" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="36" cy="76" r="2.5" fill="#FFF4DC" />
              </g>
            </g>
          ) : null}
        </motion.g>
      </motion.g>
    </svg>
  )
}
