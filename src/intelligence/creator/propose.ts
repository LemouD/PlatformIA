import { stripInvisible } from '../definitions/invisible'
import type { ConfiguredAgentDraft } from '../definitions/types'
import { validateDraft } from '../definitions/validate'
import { CREATOR_OUTPUT_SCHEMA, CREATOR_SYSTEM_PROMPT } from '../prompts/creator'
import type { ErrorCode } from '../records'
import type { EngineDeps } from '../runner/run-agent'
import { callSystemModel, SYSTEM_AGENT_IDS } from '../system/call-model'

export interface CreatorRound {
  questions: string[]
  answers: string[]
}

export interface ProposeRequest {
  description: string
  rounds: CreatorRound[]
}

export type ProposeResult =
  | { ok: true; kind: 'questions'; questions: string[] }
  | { ok: true; kind: 'proposal'; draft: ConfiguredAgentDraft; assumptions: string[] }
  | { ok: false; errorCode: ErrorCode | 'creator_invalid_proposal'; details: string[] }

interface CreatorField {
  key: string
  label: string
  type: string
  required: boolean
  maxLength: number | null
  choices: string[] | null
}

export interface CreatorProposal {
  name: string
  objective: string
  environment: string
  systemPrompt: string
  inputFields: CreatorField[]
  outputSchemaJson: string
  model: string
  effort: string
  maxRunsPerDay: number
  maxOutputTokens: number
  testInput: { key: string; value: string }[]
}

interface CreatorReply {
  kind: 'questions' | 'proposal'
  questions: string[]
  assumptions: string[]
  proposal: CreatorProposal | null
}

const MAX_ROUNDS = 2
const MAX_QUESTIONS = 3
const clean = (text: string) => stripInvisible(text).value.slice(0, 500)
const asData = (text: string) => text.replace(/</g, '‹')

/** Turns the creator's answer into the input of validateDraft. Tools are always empty. */
export function proposalToDraft(proposal: CreatorProposal): { ok: true; draft: unknown } | { ok: false; errors: string[] } {
  let outputSchema: unknown
  try {
    outputSchema = JSON.parse(proposal.outputSchemaJson)
  } catch {
    return { ok: false, errors: ["outputSchemaJson: ce n'est pas du JSON valide"] }
  }
  return {
    ok: true,
    draft: {
      name: proposal.name,
      objective: proposal.objective,
      environment: proposal.environment,
      systemPrompt: proposal.systemPrompt,
      inputFields: proposal.inputFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        ...(f.maxLength !== null ? { maxLength: f.maxLength } : {}),
        ...(f.choices !== null ? { choices: f.choices } : {}),
      })),
      outputSchema,
      model: proposal.model,
      effort: proposal.effort,
      limits: { maxRunsPerDay: proposal.maxRunsPerDay, maxOutputTokens: proposal.maxOutputTokens },
      tools: [],
      testInput: Object.fromEntries(proposal.testInput.map((t) => [t.key, t.value])),
    },
  }
}

function buildText(request: ProposeRequest, mustPropose: boolean, previousErrors: string[]): string {
  const parts = [`<besoin>\n${asData(request.description)}\n</besoin>`]
  request.rounds.forEach((round, i) => {
    const lines = round.questions.map((q, j) => `Q : ${asData(q)}\nR : ${asData(round.answers[j] ?? '(sans réponse)')}`)
    parts.push(`<tour numero="${i + 1}">\n${lines.join('\n')}\n</tour>`)
  })
  if (mustPropose) parts.push('Tu dois maintenant proposer une fiche (kind = "proposal") et lister tes hypothèses.')
  if (previousErrors.length > 0) {
    parts.push(
      `Ta proposition précédente a été rejetée par le contrôle automatique pour ces raisons :\n- ${previousErrors.join('\n- ')}\nPropose une fiche corrigée.`,
    )
  }
  return parts.join('\n\n')
}

export async function proposeAgent(deps: EngineDeps, request: ProposeRequest): Promise<ProposeResult> {
  let mustPropose = request.rounds.length >= MAX_ROUNDS
  let errors: string[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    const call = await callSystemModel(deps, {
      agentId: SYSTEM_AGENT_IDS.creator,
      system: CREATOR_SYSTEM_PROMPT,
      text: buildText(request, mustPropose, errors),
      outputSchema: CREATOR_OUTPUT_SCHEMA,
      maxOutputTokens: 8000,
      effort: 'medium',
    })
    if (!call.ok) return { ok: false, errorCode: call.errorCode, details: call.details }
    // Safe: callSystemModel has validated call.json against CREATOR_OUTPUT_SCHEMA.
    const reply = call.json as CreatorReply

    if (reply.kind === 'questions' && !mustPropose && reply.questions.length > 0) {
      return { ok: true, kind: 'questions', questions: reply.questions.slice(0, MAX_QUESTIONS).map(clean) }
    }
    if (reply.kind === 'questions' || reply.proposal === null) {
      mustPropose = true
      errors = ['aucune fiche proposée']
      continue
    }
    const converted = proposalToDraft(reply.proposal)
    const validation = converted.ok ? validateDraft(converted.draft) : { ok: false as const, errors: converted.errors }
    if (validation.ok) {
      return { ok: true, kind: 'proposal', draft: validation.draft, assumptions: reply.assumptions.map(clean) }
    }
    errors = validation.errors
  }
  return { ok: false, errorCode: 'creator_invalid_proposal', details: errors }
}
