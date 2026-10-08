/** Turns an agent's JSON output into readable Markdown, for the terminal and for saved files. */

function label(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function primitive(value: string | number | boolean | null): string {
  if (value === null) return '—'
  return typeof value === 'string' ? value.replace(/_/g, ' ') : String(value)
}

function renderObjectInline(value: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const [key, child] of Object.entries(value)) {
    if (isPrimitive(child)) lines.push(`**${label(key)}** : ${primitive(child)}`)
    else if (Array.isArray(child) && child.every(isPrimitive)) {
      lines.push(`**${label(key)}** :`)
      for (const item of child) lines.push(`  - ${primitive(item)}`)
    } else lines.push(`**${label(key)}** : ${JSON.stringify(child)}`)
  }
  return lines
}

function render(value: unknown, level: number): string[] {
  if (isPrimitive(value)) return [primitive(value)]
  if (Array.isArray(value)) {
    if (value.length === 0) return ['—']
    if (value.every(isPrimitive)) return value.map((item) => `- ${primitive(item)}`)
    return value.flatMap((item, i) => [
      `${'#'.repeat(Math.min(level, 6))} ${i + 1}.`,
      ...(typeof item === 'object' && item !== null ? renderObjectInline(item as Record<string, unknown>) : render(item, level + 1)),
      '',
    ])
  }
  const lines: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isPrimitive(child)) {
      lines.push(`**${label(key)}** : ${primitive(child)}`, '')
    } else {
      lines.push(`${'#'.repeat(Math.min(level, 6))} ${label(key)}`, '', ...render(child, level + 1), '')
    }
  }
  return lines
}

export function renderMarkdown(title: string, output: unknown): string {
  return [`# ${title}`, '', ...render(output, 2)].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
