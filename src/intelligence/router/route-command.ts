import { stripInvisible } from '../definitions/invisible'
import type { ConfiguredAgent } from '../definitions/types'
import { createEventFactory } from '../events'
import { appendAudit } from '../lifecycle/service'
import { CEILINGS } from '../limits/ceilings'
import { NOVA_OUTPUT_SCHEMA, NOVA_SYSTEM_PROMPT } from '../prompts/nova'
import type { ErrorCode } from '../records'
import type { EngineDeps } from '../runner/run-agent'
import { callSystemModel, SYSTEM_AGENT_IDS } from '../system/call-model'
import { sanitizePrefill } from './prefill'

export type RouterDeps = EngineDeps & { novaAgentId: string }

/** inputSanitized: invisible characters were removed from the command before sending. */
export type RouteResult =
  | {
      ok: true
      kind: 'agent'
      agentId: string
      reason: string
      prefill: Record<string, string>
      handoffId: string
      inputSanitized: boolean
    }
  | { ok: true; kind: 'no_agent'; reason: string; inputSanitized: boolean }
  | { ok: false; errorCode: ErrorCode; details: string[] }

interface NovaReply {
  agentId: string | null
  reason: string
  prefill: { key: string; value: string }[]
}

const COMPONENT = 'router.nova'
const asData = (text: string) => text.replace(/</g, '‹')

function describeCandidates(candidates: ConfiguredAgent[]): string {
  return candidates
    .map((a) => {
      const fields = a.inputFields.map((f) => `${f.key} (${f.type}${f.choices ? ` : ${f.choices.join(' | ')}` : ''}) : ${f.label}`)
      return `- id : ${a.id}\n  nom : ${a.name}\n  objectif : ${a.objective}\n  champs : ${fields.join(' ; ')}`
    })
    .join('\n')
}

export async function routeCommand(deps: RouterDeps, rawCommand: string): Promise<RouteResult> {
  const ev = createEventFactory(deps.clock, deps.newId)
  const nova = deps.novaAgentId
  // A command pasted from an e-mail or a web page may hide instructions in invisible characters.
  const { value: command, stripped: inputSanitized } = stripInvisible(rawCommand)

  if (command.trim() === '' || command.length > CEILINGS.commandMaxChars) {
    deps.events.emit(ev.log('warn', COMPONENT, 'routing refused: invalid_input'))
    await appendAudit(deps, 'router', 'route_refused', nova, { errorCode: 'invalid_input' })
    return { ok: false, errorCode: 'invalid_input', details: [`${CEILINGS.commandMaxChars} caractères au plus`] }
  }

  const candidates = (await deps.agents.listConfigured()).filter(
    (a) => a.lifecycle === 'active' && a.availability === 'online',
  )
  if (candidates.length === 0) return { ok: true, kind: 'no_agent', reason: 'Aucun agent actif.', inputSanitized }

  deps.events.emit(ev.statusChanged(nova, 'THINKING', 'Choosing an agent'))
  const call = await callSystemModel(deps, {
    agentId: SYSTEM_AGENT_IDS.router,
    system: NOVA_SYSTEM_PROMPT,
    text: `<agents>\n${asData(describeCandidates(candidates))}\n</agents>\n\n<commande>\n${asData(command)}\n</commande>`,
    outputSchema: NOVA_OUTPUT_SCHEMA,
    maxOutputTokens: 2000,
    effort: 'low',
  })

  if (!call.ok) {
    deps.events.emit(ev.statusChanged(nova, 'ERROR', `Routing failed: ${call.errorCode}`))
    deps.events.emit(ev.log('error', COMPONENT, `routing failed: ${call.errorCode}`))
    return call
  }

  // Safe: callSystemModel has validated call.json against NOVA_OUTPUT_SCHEMA.
  const reply = call.json as NovaReply
  const reason = stripInvisible(reply.reason).value.slice(0, 300)
  const chosen = candidates.find((a) => a.id === reply.agentId)
  deps.events.emit(ev.statusChanged(nova, 'COMPLETED', chosen ? `Routed to ${chosen.name}` : 'No suitable agent'))

  if (!chosen) {
    if (reply.agentId !== null) await appendAudit(deps, 'router', 'unknown_agent_chosen', nova, {})
    return { ok: true, kind: 'no_agent', reason, inputSanitized }
  }

  const { handoffId, event } = ev.handoffStarted(nova, chosen.id, reason)
  deps.events.emit(event)
  const prefill = sanitizePrefill(chosen.inputFields, reply.prefill)
  return { ok: true, kind: 'agent', agentId: chosen.id, reason, prefill, handoffId, inputSanitized }
}

/** Called when Lemou launches the run or closes the form. */
export function completeHandoff(deps: RouterDeps, handoffId: string): void {
  deps.events.emit(createEventFactory(deps.clock, deps.newId).handoffCompleted(handoffId))
}
