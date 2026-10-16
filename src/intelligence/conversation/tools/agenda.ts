import { RECORD_LIMITS, cleanEvent, cleanReminder, insertRecord, isLocalDate, updateRecord, type EventInput } from '../records'
import type { ConversationTool, EventRecord } from '../types'
import { bool, line, nullable, obj, readsExternal, str } from './schema'

const DAY_MS = 86_400_000
const dayOf = (local: string) => local.slice(0, 10)
const daysBetween = (from: string, to: string) => (Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / DAY_MS

function describe(e: Pick<EventRecord, 'title' | 'start' | 'end' | 'allDay'>): string {
  const when = e.allDay ? dayOf(e.start) : e.start.replace('T', ' à ')
  return `${e.title}, ${when}${e.end ? ` jusqu’à ${e.end.replace('T', ' à ')}` : ''}`
}

export const readAgenda: ConversationTool = {
  name: 'lire_agenda',
  description: 'Lit les événements de son agenda entre deux dates (AAAA-MM-JJ), 62 jours au plus.',
  inputSchema: obj({ du: str('Premier jour, AAAA-MM-JJ.'), au: str('Dernier jour, AAAA-MM-JJ.') }),
  kind: 'read',
  async run(ctx, args) {
    const { du, au } = args as { du: string; au: string }
    if (!isLocalDate(du) || !isLocalDate(au) || du.length !== 10 || au.length !== 10) return { content: 'Dates invalides (AAAA-MM-JJ).', isError: true }
    const span = daysBetween(du, au)
    if (span < 0 || span > RECORD_LIMITS.agendaMaxDays) return { content: `Période invalide (${RECORD_LIMITS.agendaMaxDays} jours au plus).`, isError: true }
    const events = (await ctx.space.events.list())
      .filter((e) => dayOf(e.start) <= au && dayOf(e.end ?? e.start) >= du)
      .sort((a, b) => a.start.localeCompare(b.start))
    if (events.length === 0) return { content: 'Aucun événement sur cette période.' }
    return {
      content: events.map((e) => line(e, `${describe(e)}${e.notes ? ` — ${e.notes}` : ''}`)).join('\n'),
      readsExternal: readsExternal(events),
    }
  },
}

type EventArgs = { titre: string; debut: string; fin: string | null; journee: boolean; notes: string }
const toInput = (a: EventArgs): EventInput => ({ title: a.titre, start: a.debut, end: a.fin, allDay: a.journee, notes: a.notes })

const eventProperties = {
  titre: str('Titre, 200 caractères au plus.'),
  debut: str('Début en heure locale : AAAA-MM-JJ pour une journée entière, sinon AAAA-MM-JJTHH:MM.'),
  fin: nullable(str('Fin, même format, ou null.')),
  journee: bool('Vrai pour un événement sur la journée entière.'),
  notes: str('Notes, 1000 caractères au plus, chaîne vide sinon.'),
}

export const addEvent: ConversationTool = {
  name: 'ajouter_evenement',
  description: 'Ajoute un événement à son agenda.',
  inputSchema: obj(eventProperties),
  kind: 'add',
  async plan(ctx, args) {
    const fields = cleanEvent(toInput(args as EventArgs))
    if (!fields) return { error: 'Événement invalide : titre, dates (AAAA-MM-JJ ou AAAA-MM-JJTHH:MM) ou notes trop longues.' }
    if ((await ctx.space.events.list()).length >= RECORD_LIMITS.events) return { error: 'Agenda plein.' }
    return { preview: `Ajouter à l’agenda : ${describe(fields)}`, target: null }
  },
  async apply(ctx, args, origin) {
    const fields = cleanEvent(toInput(args as EventArgs))
    if (!fields) return { error: 'Événement invalide.' }
    const event = await insertRecord(ctx.space.events, fields, { id: ctx.newId(), now: ctx.now, origin })
    return { created: [{ repo: 'events', id: event.id, version: event.version }], label: `Ajouté à l’agenda : ${describe(event)}` }
  },
}

type EditEventArgs = { id: string; titre: string | null; debut: string | null; fin: string | null; journee: boolean | null; notes: string | null }

function merged(current: EventRecord, a: EditEventArgs): EventInput {
  return {
    title: a.titre ?? current.title,
    start: a.debut ?? current.start,
    // To remove an end date, she edits the event on her screen.
    end: a.fin ?? current.end,
    allDay: a.journee ?? current.allDay,
    notes: a.notes ?? current.notes,
  }
}

export const editEvent: ConversationTool = {
  name: 'modifier_evenement',
  description: 'Modifie un événement de l’agenda ; null laisse un champ inchangé. Demande toujours sa confirmation.',
  inputSchema: obj({
    id: str('Identifiant de l’événement.'),
    titre: nullable(eventProperties.titre),
    debut: nullable(eventProperties.debut),
    fin: nullable(str('Nouvelle fin, ou null pour ne pas la changer.')),
    journee: nullable(eventProperties.journee),
    notes: nullable(eventProperties.notes),
  }),
  kind: 'change',
  async plan(ctx, args) {
    const a = args as EditEventArgs
    const current = await ctx.space.events.get(a.id)
    if (!current) return { error: 'Introuvable.' }
    const fields = cleanEvent(merged(current, a))
    if (!fields) return { error: 'Modification invalide.' }
    return { preview: `Modifier « ${describe(current)} » → ${describe(fields)}`, target: { repo: 'events', id: current.id, version: current.version } }
  },
  async apply(ctx, args) {
    const a = args as EditEventArgs
    const current = await ctx.space.events.get(a.id)
    if (!current) return { error: 'Introuvable.' }
    const fields = cleanEvent(merged(current, a))
    if (!fields) return { error: 'Modification invalide.' }
    const result = await updateRecord(ctx.space.events, current.id, current.version, ctx.now, (e) => ({ ...e, ...fields }))
    return result.ok ? { created: [], label: `Modifié : ${describe(fields)}` } : { error: 'Modification impossible.' }
  },
}

export const deleteEvent: ConversationTool = {
  name: 'supprimer_evenement',
  description: 'Supprime un événement de l’agenda. Un seul à la fois. Demande toujours sa confirmation.',
  inputSchema: obj({ id: str('Identifiant de l’événement.') }),
  kind: 'change',
  async plan(ctx, args) {
    const event = await ctx.space.events.get((args as { id: string }).id)
    if (!event) return { error: 'Introuvable.' }
    return { preview: `Supprimer de l’agenda : ${describe(event)}`, target: { repo: 'events', id: event.id, version: event.version } }
  },
  async apply(ctx, args) {
    const event = await ctx.space.events.get((args as { id: string }).id)
    if (!event) return { error: 'Introuvable.' }
    await ctx.space.events.remove(event.id)
    return { created: [], label: `Supprimé : ${describe(event)}` }
  },
}

type ReminderArgs = { quand: string; texte: string; evenement_id: string | null }

export const createReminder: ConversationTool = {
  name: 'creer_rappel',
  description: 'Crée un rappel, affiché quand elle ouvre l’application après l’heure prévue. Aucune notification n’est envoyée.',
  inputSchema: obj({
    quand: str('Date et heure locales, AAAA-MM-JJTHH:MM.'),
    texte: str('Texte du rappel, 200 caractères au plus.'),
    evenement_id: nullable(str('Identifiant d’un événement lié, ou null.')),
  }),
  kind: 'add',
  async plan(ctx, args) {
    const a = args as ReminderArgs
    if (a.quand.length !== 16) return { error: 'Heure attendue : AAAA-MM-JJTHH:MM.' }
    const fields = cleanReminder({ when: a.quand, text: a.texte, eventId: a.evenement_id }, ctx.timeZone)
    if (!fields) return { error: 'Rappel invalide : date ou texte.' }
    if (a.evenement_id !== null && !(await ctx.space.events.get(a.evenement_id))) return { error: 'Événement introuvable.' }
    if ((await ctx.space.reminders.list()).length >= RECORD_LIMITS.reminders) return { error: 'Trop de rappels.' }
    return { preview: `Rappel le ${a.quand.replace('T', ' à ')} : ${fields.text}`, target: null }
  },
  async apply(ctx, args, origin) {
    const a = args as ReminderArgs
    const fields = cleanReminder({ when: a.quand, text: a.texte, eventId: a.evenement_id }, ctx.timeZone)
    if (!fields) return { error: 'Rappel invalide.' }
    const reminder = await insertRecord(ctx.space.reminders, fields, { id: ctx.newId(), now: ctx.now, origin })
    return { created: [{ repo: 'reminders', id: reminder.id, version: reminder.version }], label: `Rappel le ${a.quand.replace('T', ' à ')} : ${fields.text}` }
  },
}
