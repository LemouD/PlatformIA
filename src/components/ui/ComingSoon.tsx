interface ComingSoonProps {
  title: string
  description: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[7px] px-9 pt-[30px]">
      <p className="font-mono text-[9px] uppercase text-info">Coming soon</p>
      <h1 className="font-display text-[32px] italic text-ink">{title}</h1>
      <p className="text-xs text-ink-muted">{description}</p>
    </div>
  )
}
