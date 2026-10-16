import { RECORD_LIMITS, cleanField, insertRecord, listKind, updateRecord } from '../records'
import type { ConversationTool, ListItemRecord, ListRecord, RecordRef } from '../types'
import { bool, line, nullable, obj, readsExternal, str, strings } from './schema'

const sameName = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0

export const readLists: ConversationTool = {
  name: 'lire_listes',
  description: 'Lit ses listes (courses, idées, autres) et leurs éléments. Chaîne vide pour toutes les listes.',
  inputSchema: obj({ liste: str('Nom de la liste, ou chaîne vide pour toutes.') }),
  kind: 'read',
  async run(ctx, args) {
    const { liste } = args as { liste: string }
    const lists = (await ctx.space.lists.list()).filter((l) => !liste || sameName(l.name, liste))
    if (lists.length === 0) return { content: liste ? 'Liste introuvable.' : 'Aucune liste.' }
    const items = await ctx.space.listItems.list()
    const shown: (ListRecord | ListItemRecord)[] = [...lists]
    const blocks = lists.map((l) => {
      const own = items.filter((i) => i.listId === l.id).sort((a, b) => a.createdAt - b.createdAt)
      shown.push(...own)
      const body = own.map((i) => line(i, `${i.done ? '[fait] ' : ''}${i.text}`)).join('\n') || '(vide)'
      return `${line(l, `Liste « ${l.name} »`)}\n${body}`
    })
    return { content: blocks.join('\n\n'), readsExternal: readsExternal(shown) }
  },
}

type AddArgs = { liste: string; elements: string[] }

function cleanAdd(args: AddArgs): { name: string; texts: string[] } | { error: string } {
  const name = cleanField(args.liste, RECORD_LIMITS.listNameChars)
  if (!name) return { error: 'Nom de liste invalide.' }
  if (args.elements.length === 0 || args.elements.length > RECORD_LIMITS.itemsPerAdd) {
    return { error: `Entre 1 et ${RECORD_LIMITS.itemsPerAdd} éléments par ajout.` }
  }
  const texts = args.elements.map((e) => cleanField(e, RECORD_LIMITS.itemChars))
  if (texts.some((t) => t === null)) return { error: `Élément vide ou trop long (${RECORD_LIMITS.itemChars} caractères au plus).` }
  return { name, texts: texts as string[] }
}

export const addListItems: ConversationTool = {
  name: 'ajouter_elements',
  description: 'Ajoute des éléments à une liste (courses, idées ou autre), et crée la liste si elle n’existe pas.',
  inputSchema: obj({ liste: str('Nom de la liste, par exemple « courses ».'), elements: strings('Éléments à ajouter, 20 au plus.') }),
  kind: 'add',
  async plan(ctx, args) {
    const clean = cleanAdd(args as AddArgs)
    if ('error' in clean) return clean
    const lists = await ctx.space.lists.list()
    const list = lists.find((l) => sameName(l.name, clean.name))
    if (!list && lists.length >= RECORD_LIMITS.lists) return { error: 'Nombre maximal de listes atteint.' }
    const count = list ? (await ctx.space.listItems.list()).filter((i) => i.listId === list.id).length : 0
    if (count + clean.texts.length > RECORD_LIMITS.itemsPerList) return { error: 'Liste pleine.' }
    return { preview: `Ajouter à « ${clean.name} » : ${clean.texts.join(', ')}`, target: null }
  },
  async apply(ctx, args, origin) {
    const clean = cleanAdd(args as AddArgs)
    if ('error' in clean) return clean
    const created: RecordRef[] = []
    let list = (await ctx.space.lists.list()).find((l) => sameName(l.name, clean.name))
    if (!list) {
      list = await insertRecord(ctx.space.lists, { name: clean.name, kind: listKind(clean.name) }, { id: ctx.newId(), now: ctx.now, origin })
      created.push({ repo: 'lists', id: list.id, version: list.version })
    }
    for (const text of clean.texts) {
      const item = await insertRecord(ctx.space.listItems, { listId: list.id, text, done: false }, { id: ctx.newId(), now: ctx.now, origin })
      created.push({ repo: 'listItems', id: item.id, version: item.version })
    }
    return { created, label: `Ajouté à « ${list.name} » : ${clean.texts.join(', ')}` }
  },
}

type EditArgs = { id: string; texte: string | null; fait: boolean | null }

export const editListItem: ConversationTool = {
  name: 'modifier_element',
  description: 'Modifie le texte d’un élément de liste ou le coche. Demande toujours sa confirmation.',
  inputSchema: obj({ id: str('Identifiant de l’élément.'), texte: nullable(str('Nouveau texte, ou null.')), fait: nullable(bool('Coché, ou null.')) }),
  kind: 'change',
  async plan(ctx, args) {
    const { id, texte, fait } = args as EditArgs
    const item = await ctx.space.listItems.get(id)
    if (!item) return { error: 'Introuvable.' }
    const text = texte === null ? null : cleanField(texte, RECORD_LIMITS.itemChars)
    if (texte !== null && !text) return { error: 'Texte vide ou trop long.' }
    if (text === null && fait === null) return { error: 'Rien à modifier.' }
    const parts = [text !== null ? `« ${item.text} » → « ${text} »` : `« ${item.text} »`, fait === null ? '' : fait ? '(cocher)' : '(décocher)']
    return { preview: `Modifier ${parts.join(' ').trim()}`, target: { repo: 'listItems', id, version: item.version } }
  },
  async apply(ctx, args) {
    const { id, texte, fait } = args as EditArgs
    const current = await ctx.space.listItems.get(id)
    if (!current) return { error: 'Introuvable.' }
    const text = texte === null ? current.text : cleanField(texte, RECORD_LIMITS.itemChars)
    if (!text) return { error: 'Texte invalide.' }
    const result = await updateRecord(ctx.space.listItems, id, current.version, ctx.now, (i) => ({ ...i, text, done: fait ?? i.done }))
    return result.ok ? { created: [], label: `Modifié : ${text}` } : { error: 'Modification impossible.' }
  },
}

export const deleteListItem: ConversationTool = {
  name: 'supprimer_element',
  description: 'Supprime un élément de liste. Un seul à la fois. Demande toujours sa confirmation.',
  inputSchema: obj({ id: str('Identifiant de l’élément.') }),
  kind: 'change',
  async plan(ctx, args) {
    const item = await ctx.space.listItems.get((args as { id: string }).id)
    if (!item) return { error: 'Introuvable.' }
    return { preview: `Supprimer « ${item.text} »`, target: { repo: 'listItems', id: item.id, version: item.version } }
  },
  async apply(ctx, args) {
    const item = await ctx.space.listItems.get((args as { id: string }).id)
    if (!item) return { error: 'Introuvable.' }
    await ctx.space.listItems.remove(item.id)
    return { created: [], label: `Supprimé : ${item.text}` }
  },
}
