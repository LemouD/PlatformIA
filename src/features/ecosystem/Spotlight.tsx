interface SpotlightProps {
  opacity: number
  className: string
}

/** Cone of light falling on a robot, coloured by the --agent-state of its territory. */
export function Spotlight({ opacity, className }: SpotlightProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute transition-opacity duration-500 ${className}`}
      style={{
        opacity,
        background: 'linear-gradient(to bottom, transparent, var(--agent-state))',
        clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
      }}
    />
  )
}
