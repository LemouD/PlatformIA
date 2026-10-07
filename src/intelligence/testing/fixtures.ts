import type { ConfiguredAgentDraft } from '../definitions/types'

export function menuDraft(overrides: Partial<ConfiguredAgentDraft> = {}): ConfiguredAgentDraft {
  return {
    name: 'Générateur de menus',
    objective: 'Proposer des recettes à partir des ingrédients disponibles, avec la liste de courses.',
    environment: 'personal',
    systemPrompt:
      'Tu proposes trois recettes familiales simples à partir des ingrédients fournis. Tu indiques pour chacune les ingrédients manquants.',
    inputFields: [
      { key: 'ingredients', label: 'Ingrédients disponibles', type: 'longtext', required: true, maxLength: 2000 },
      { key: 'people', label: 'Nombre de personnes', type: 'number', required: true },
      { key: 'diet', label: 'Régime', type: 'choice', required: false, choices: ['aucun', 'végétarien', 'sans porc'] },
    ],
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['recipes', 'shoppingList'],
      properties: {
        recipes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'steps'],
            properties: {
              name: { type: 'string' },
              steps: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        shoppingList: { type: 'array', items: { type: 'string' } },
      },
    },
    model: 'claude-sonnet-5-5',
    effort: 'low',
    limits: { maxRunsPerDay: 10, maxOutputTokens: 4000 },
    tools: [],
    testInput: { ingredients: 'riz, oignons, poulet, tomates', people: '4' },
    ...overrides,
  }
}
