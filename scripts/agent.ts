/**
 * Terminal launcher for the work agents, usable before the AI OS interface exists.
 *
 *   npm run agent -- "prépare l'atelier de cadrage pour l'automatisation des devis"   (NOVA choisit l'agent)
 *   npm run agent -- --liste
 *   npm run agent -- cadrage --besoin "texte" --contexte @notes.txt --document ./besoin.pdf
 *   npm run agent -- cadrage --exemple
 *
 * A value starting with "@" is read from a text file. Attachment fields take a file path.
 * The API key comes from ANTHROPIC_API_KEY in the terminal environment only: never a command-line argument
 * (visible in the process list), never written to a file, a log or the output.
 * Spending is capped per run by AI_OS_RUN_BUDGET_USD (1 USD by default, 5 USD at most), separately from the server.
 * Results are printed and saved as Markdown in ./sorties/.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { renderMarkdown } from '@/intelligence/catalog/render'
import { WORK_AGENTS } from '@/intelligence/catalog/work-agents'
import { stripInvisible } from '@/domain/sanitize'
import { computeRiskLevel } from '@/intelligence/definitions/risk'
import type { ConfiguredAgent } from '@/intelligence/definitions/types'
import { validateDraft } from '@/intelligence/definitions/validate'
import { MemoryEventSink } from '@/intelligence/events'
import { createBudgetGuard } from '@/intelligence/limits/budget'
import { createAnthropicLlmClient } from '@/intelligence/llm/anthropic-client'
import { routeCommand, type RouterDeps } from '@/intelligence/router/route-command'
import { runAgent } from '@/intelligence/runner/run-agent'
import { MemoryAgentStore, MemoryAuditLog, MemoryExecutionStore } from '@/intelligence/testing/memory-ports'

/** Model output and agent text are printed as plain text: control characters (ANSI escapes) are removed first. */
function plain(text: string): string {
  return stripInvisible(text).value
}

function fail(message: string): never {
  console.error(plain(message))
  process.exit(1)
}

const DEFAULT_RUN_CEILING_USD = 1
const MAX_RUN_CEILING_USD = 5

function runCeilingUsd(): number {
  const value = Number(process.env.AI_OS_RUN_BUDGET_USD ?? DEFAULT_RUN_CEILING_USD)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RUN_CEILING_USD
  return Math.min(value, MAX_RUN_CEILING_USD)
}

function printList(): void {
  for (const [key, draft] of Object.entries(WORK_AGENTS)) {
    console.log(`\n${key} — ${draft.name}\n  ${draft.objective}`)
    for (const field of draft.inputFields) {
      const choices = field.choices ? ` (${field.choices.join(' | ')})` : ''
      console.log(`  --${field.key}${field.required ? ' (obligatoire)' : ''} : ${field.label}${choices}`)
    }
  }
}

function parseArgs(argv: string[]): { positionals: string[]; options: Map<string, string>; flags: Set<string> } {
  const options = new Map<string, string>()
  const flags = new Set<string>()
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const name = arg.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) flags.add(name)
    else {
      options.set(name, next)
      i++
    }
  }
  return { positionals, options, flags }
}

/**
 * All work agents, active, in a throwaway in-memory store: this launcher is a local tool, not the product flow.
 * Every fiche still goes through validateDraft, and the risk level is computed from its (empty) tool list.
 */
async function loadAgents(deps: RouterDeps): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  const now = Date.now()
  for (const [key, entry] of Object.entries(WORK_AGENTS)) {
    const validation = validateDraft(entry)
    if (!validation.ok) fail(`Fiche invalide « ${key} » : ${validation.errors.join(' ; ')}`)
    const draft = validation.draft
    const agent: ConfiguredAgent = {
      ...draft,
      id: key,
      family: 'configured',
      kind: 'on_demand',
      riskLevel: computeRiskLevel(draft.tools),
      lifecycle: 'active',
      availability: 'online',
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    await deps.agents.insert(agent)
    ids.set(key, agent.id)
  }
  return ids
}

async function main(): Promise<void> {
  const { positionals, options, flags } = parseArgs(process.argv.slice(2))
  if (flags.has('liste') || positionals.length === 0) {
    printList()
    return
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) fail('Définissez ANTHROPIC_API_KEY dans ce terminal avant de lancer un agent.')

  const executions = new MemoryExecutionStore()
  const deps: RouterDeps = {
    agents: new MemoryAgentStore(),
    executions,
    audit: new MemoryAuditLog(),
    clock: { now: () => Date.now() },
    newId: () => randomUUID(),
    llm: createAnthropicLlmClient({ apiKey }),
    events: new MemoryEventSink(),
    budget: createBudgetGuard(),
    // The launcher has its own ceiling per run, separate from the server's monthly budget:
    // its in-memory reservations are not shared with another process.
    settings: { monthlyBudgetUsd: runCeilingUsd(), llmTimeoutMs: 120_000 },
    novaAgentId: 'nova',
  }
  await loadAgents(deps)

  // Either an agent name, or a request in plain French that NOVA routes to the right agent.
  let key = positionals.length === 1 && positionals[0] && WORK_AGENTS[positionals[0]] ? positionals[0] : undefined
  const fields: Record<string, string> = {}
  if (!key) {
    console.error('NOVA choisit l’agent…')
    const routed = await routeCommand(deps, positionals.join(' '))
    if (!routed.ok) fail(`Routage impossible : ${routed.errorCode}`)
    if (routed.kind === 'no_agent') fail(`Aucun agent adapté : ${routed.reason}`)
    key = routed.agentId
    Object.assign(fields, routed.prefill)
    console.error(plain(`→ ${WORK_AGENTS[key]?.name ?? key} : ${routed.reason}`))
  }
  const draft = WORK_AGENTS[key]
  if (!draft) fail(`Agent inconnu : ${key}. Lancez « npm run agent -- --liste ».`)
  if (flags.has('exemple')) Object.assign(fields, draft.testInput)
  const attachments: { fieldKey: string; name: string; bytes: Uint8Array }[] = []
  for (const field of draft.inputFields) {
    const value = options.get(field.key)
    if (value === undefined) continue
    if (field.type === 'attachment') {
      attachments.push({ fieldKey: field.key, name: basename(value), bytes: new Uint8Array(readFileSync(value)) })
    } else {
      fields[field.key] = value.startsWith('@') ? readFileSync(value.slice(1), 'utf8') : value
    }
  }

  const missing = draft.inputFields.filter((f) => f.required && f.type !== 'attachment' && !fields[f.key])
  if (missing.length > 0) {
    fail(
      `Il manque : ${missing.map((f) => `--${f.key} (${f.label})`).join(', ')}.\n` +
        `Relancez avec : npm run agent -- ${key} ${missing.map((f) => `--${f.key} "…"`).join(' ')}`,
    )
  }

  console.error(`${draft.name} : appel au modèle ${draft.model}…`)
  const result = await runAgent(deps, { agentId: key, mode: 'live', origin: 'form', fields, attachments })
  if (!result.ok) fail(`Échec : ${result.errorCode}${result.details.length ? ` (${result.details.join(' ; ')})` : ''}`)

  const markdown = plain(renderMarkdown(draft.name, result.output))
  console.log(markdown)
  if (result.inputSanitized) console.error('Caractères invisibles retirés de la saisie avant l’envoi.')
  const total = executions.records.reduce((sum, r) => sum + r.costUsd, 0)
  console.error(`Coût : ${total.toFixed(4)} $`)

  mkdirSync('sorties', { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const file = join('sorties', `${key}-${stamp}.md`)
  writeFileSync(file, markdown, 'utf8')
  console.error(`Enregistré : ${file}`)
}

await main()
