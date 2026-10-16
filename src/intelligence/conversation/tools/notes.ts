import { RECORD_LIMITS, cleanDraft, cleanNote, insertRecord, updateRecord, type NoteInput } from '../records'
import type { ConversationTool, NoteRecord } from '../types'
import { line, nullable, obj, readsExternal, str } from './schema'

const PREVIEW_CHARS = 120
const short = (text: string) => ([...text].length > PREVIEW_CHARS ? `${[...text].slice(0, PREVIEW_CHARS - 1).join('')}…` : text)

/** Notes matching every word of the search, accents and case ignored. Search runs in memory, during her session. */
function matches(note: NoteRecord, search: string): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const haystack = fold(`${note.title} ${note.subject ?? ''} ${note.text}`)
  return fold(search).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}

export const readNotes: ConversationTool = {
  name: 'lire_notes',
  description: 'Cherche dans ses notes d’apprentissage et de cours. Chaîne vide pour la liste des titres.',
  inputSchema: obj({ recherche: str('Mots à chercher, ou chaîne vide.') }),
  kind: 'read',
  async run(ctx, args) {
    const { recherche } = args as { recherche: string }
    const notes = (await ctx.space.notes.list()).sort((a, b) => b.updatedAt - a.updatedAt)
    if (!recherche.trim()) {
      if (notes.length === 0) return { content: 'Aucune note.' }
      return { content: notes.map((n) => line(n, `${n.title}${n.subject ? ` (${n.subject})` : ''}`)).join('\n'), readsExternal: readsExternal(notes) }
    }
    const found = notes.filter((n) => matches(n, recherche)).slice(0, 5)
    if (found.length === 0) return { content: 'Aucune note trouvée.' }
    return {
      content: found.map((n) => `${line(n, `${n.title}${n.subject ? ` (${n.subject})` : ''}`)}\n${n.text}`).join('\n\n'),
      readsExternal: readsExternal(found),
    }
  },
}

type NoteArgs = { titre: string; texte: string; sujet: string | null }
const toInput = (a: NoteArgs): NoteInput => ({ title: a.titre, text: a.texte, subject: a.sujet })

export const addNote: ConversationTool = {
  name: 'ajouter_note',
  description: 'Crée une note d’apprentissage ou de cours.',
  inputSchema: obj({
    titre: str('Titre, 120 caractères au plus.'),
    texte: str('Contenu, 8000 caractères au plus.'),
    sujet: nullable(str('Matière ou sujet, ou null.')),
  }),
  kind: 'add',
  async plan(ctx, args) {
    const fields = cleanNote(toInput(args as NoteArgs))
    if (!fields) return { error: 'Note invalide : titre ou texte vide ou trop long.' }
    if ((await ctx.space.notes.list()).length >= RECORD_LIMITS.notes) return { error: 'Trop de notes.' }
    return { preview: `Créer la note « ${fields.title} » : ${short(fields.text)}`, target: null }
  },
  async apply(ctx, args, origin) {
    const fields = cleanNote(toInput(args as NoteArgs))
    if (!fields) return { error: 'Note invalide.' }
    const note = await insertRecord(ctx.space.notes, fields, { id: ctx.newId(), now: ctx.now, origin })
    return { created: [{ repo: 'notes', id: note.id, version: note.version }], label: `Note créée : ${note.title}` }
  },
}

type EditNoteArgs = { id: string; titre: string | null; texte: string | null; sujet: string | null }

export const editNote: ConversationTool = {
  name: 'modifier_note',
  description: 'Modifie une note ; null laisse un champ inchangé. Demande toujours sa confirmation.',
  inputSchema: obj({
    id: str('Identifiant de la note.'),
    titre: nullable(str('Nouveau titre, ou null.')),
    texte: nullable(str('Nouveau contenu complet, ou null.')),
    sujet: nullable(str('Nouveau sujet, ou null.')),
  }),
  kind: 'change',
  async plan(ctx, args) {
    const a = args as EditNoteArgs
    const current = await ctx.space.notes.get(a.id)
    if (!current) return { error: 'Introuvable.' }
    const fields = cleanNote({ title: a.titre ?? current.title, text: a.texte ?? current.text, subject: a.sujet ?? current.subject })
    if (!fields) return { error: 'Modification invalide.' }
    return { preview: `Modifier la note « ${current.title} » : ${short(fields.text)}`, target: { repo: 'notes', id: current.id, version: current.version } }
  },
  async apply(ctx, args) {
    const a = args as EditNoteArgs
    const current = await ctx.space.notes.get(a.id)
    if (!current) return { error: 'Introuvable.' }
    const fields = cleanNote({ title: a.titre ?? current.title, text: a.texte ?? current.text, subject: a.sujet ?? current.subject })
    if (!fields) return { error: 'Modification invalide.' }
    const result = await updateRecord(ctx.space.notes, current.id, current.version, ctx.now, (n) => ({ ...n, ...fields }))
    return result.ok ? { created: [], label: `Note modifiée : ${fields.title}` } : { error: 'Modification impossible.' }
  },
}

type DraftArgs = { objet: string; corps: string; destinataire: string | null }

export const writeDraft: ConversationTool = {
  name: 'rediger_brouillon',
  description: 'Enregistre un brouillon de courrier. Rien n’est envoyé : elle le recopie elle-même dans sa messagerie.',
  inputSchema: obj({
    objet: str('Objet, 200 caractères au plus.'),
    corps: str('Texte du courrier, 8000 caractères au plus.'),
    destinataire: nullable(str('Destinataire en texte libre, ou null.')),
  }),
  kind: 'add',
  async plan(ctx, args) {
    const a = args as DraftArgs
    const fields = cleanDraft({ subject: a.objet, body: a.corps, recipient: a.destinataire })
    if (!fields) return { error: 'Brouillon invalide : objet ou texte vide ou trop long.' }
    if ((await ctx.space.drafts.list()).length >= RECORD_LIMITS.drafts) return { error: 'Trop de brouillons.' }
    return { preview: `Enregistrer le brouillon « ${fields.subject} »`, target: null }
  },
  async apply(ctx, args, origin) {
    const a = args as DraftArgs
    const fields = cleanDraft({ subject: a.objet, body: a.corps, recipient: a.destinataire })
    if (!fields) return { error: 'Brouillon invalide.' }
    const draft = await insertRecord(ctx.space.drafts, fields, { id: ctx.newId(), now: ctx.now, origin })
    return { created: [{ repo: 'drafts', id: draft.id, version: draft.version }], label: `Brouillon enregistré : ${draft.subject}` }
  },
}
