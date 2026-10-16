import { stripInvisible } from '@/domain/sanitize'
import type {
  DraftRecord,
  EventRecord,
  ListItemRecord,
  ListRecord,
  NoteRecord,
  PrivateSpace,
  RecordRepo,
  ReminderRecord,
  StoredRecord,
} from './types'

/** Sizes and counts of her space (spec section 13). Checked by the code, whatever the schema says. */
export const RECORD_LIMITS = {
  lists: 50,
  listNameChars: 60,
  itemsPerList: 500,
  itemChars: 200,
  itemsPerAdd: 20,
  events: 2000,
  eventTitleChars: 200,
  eventNotesChars: 1000,
  agendaMaxDays: 62,
  notes: 500,
  noteTitleChars: 120,
  noteTextChars: 8000,
  drafts: 200,
  draftSubjectChars: 200,
  draftBodyChars: 8000,
  draftRecipientChars: 200,
  reminders: 500,
  reminderTextChars: 200,
} as const

/** Invisible characters removed, spaces trimmed, length checked in characters. Null when empty or too long. */
export function cleanField(raw: string, maxChars: number, options: { allowEmpty?: boolean } = {}): string | null {
  const text = stripInvisible(raw).value.trim()
  if (!text && !options.allowEmpty) return null
  return [...text].length <= maxChars ? text : null
}

// Local dates. One household: dates are stored without time zone, and turned into instants in her time zone.

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/

/** True for '2026-10-20' or '2026-10-20T09:30' naming a real day and time. */
export function isLocalDate(value: string): boolean {
  const m = LOCAL_DATE.exec(value)
  if (!m) return false
  const [y, mo, d, h = '0', mi = '0'] = m.slice(1).map((v) => v ?? '0') as string[]
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)))
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d) &&
    Number(h) < 24 &&
    Number(mi) < 60
  )
}

/** Offset of `timeZone` from UTC at instant `epoch`, in milliseconds. */
function zoneOffset(epoch: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(epoch)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(epoch / 1000) * 1000
}

/**
 * Instant of a local date in her time zone (midnight for a date alone), independent of the server's zone.
 * A time skipped by a daylight-saving change (02:30 on a spring night) moves forward by the gap, as calendars do;
 * a time that happens twice takes its first occurrence.
 */
export function localToEpoch(local: string, timeZone: string): number | null {
  if (!isLocalDate(local)) return null
  const m = LOCAL_DATE.exec(local)!
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0))
  const before = wall - zoneOffset(wall - 86_400_000, timeZone)
  const after = wall - zoneOffset(wall + 86_400_000, timeZone)
  // The first candidate whose own offset brings it back to the wall time is the right instant.
  for (const candidate of [Math.min(before, after), Math.max(before, after)]) {
    if (candidate + zoneOffset(candidate, timeZone) === wall) return candidate
  }
  // Skipped time: same wall time, with the offset from before the change.
  return before
}

// Generic writes. Origins and versions are set here, never by the routes.

type Fields<T extends StoredRecord> = Omit<T, keyof StoredRecord>
export type WriteResult<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'conflict' | 'invalid_input' | 'full' }

export interface ScreenDeps {
  space: PrivateSpace
  clock: { now(): number }
  newId: () => string
  settings: { timeZone: string }
}

export async function insertRecord<T extends StoredRecord>(
  repo: RecordRepo<T>,
  fields: Fields<T>,
  meta: { id: string; now: number; origin: StoredRecord['origin'] },
): Promise<T> {
  const record = { ...fields, id: meta.id, origin: meta.origin, createdAt: meta.now, updatedAt: meta.now, version: 1 } as T
  await repo.insert(record)
  return record
}

/** Changes a record she or a confirmed action edits. The origin stays: a small edit may leave an injection in place. */
export async function updateRecord<T extends StoredRecord>(
  repo: RecordRepo<T>,
  id: string,
  expectedVersion: number,
  now: number,
  change: (current: T) => T | null,
): Promise<WriteResult<T>> {
  const current = await repo.get(id)
  if (!current) return { ok: false, error: 'not_found' }
  if (current.version !== expectedVersion) return { ok: false, error: 'conflict' }
  const changed = change(current)
  if (!changed) return { ok: false, error: 'invalid_input' }
  const next = { ...changed, id: current.id, origin: current.origin, createdAt: current.createdAt, updatedAt: now, version: current.version + 1 }
  return (await repo.compareAndSet(id, expectedVersion, next)) ? { ok: true, value: next } : { ok: false, error: 'conflict' }
}

export async function deleteRecord<T extends StoredRecord>(
  repo: RecordRepo<T>,
  id: string,
  expectedVersion: number,
): Promise<WriteResult<null>> {
  const current = await repo.get(id)
  if (!current) return { ok: false, error: 'not_found' }
  if (current.version !== expectedVersion) return { ok: false, error: 'conflict' }
  await repo.remove(id)
  return { ok: true, value: null }
}

const invalid = { ok: false, error: 'invalid_input' } as const
const full = { ok: false, error: 'full' } as const

export function listKind(name: string): ListRecord['kind'] {
  const n = name.toLowerCase()
  if (n === 'courses') return 'courses'
  if (n === 'idees' || n === 'idées') return 'idees'
  return 'autre'
}

// Functions for what she changes directly on her screens. Origin 'utilisatrice', always with expectedVersion.

export async function createList(deps: ScreenDeps, name: string): Promise<WriteResult<ListRecord>> {
  const clean = cleanField(name, RECORD_LIMITS.listNameChars)
  if (!clean) return invalid
  if ((await deps.space.lists.list()).length >= RECORD_LIMITS.lists) return full
  const value = await insertRecord(deps.space.lists, { name: clean, kind: listKind(clean) }, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' })
  return { ok: true, value }
}

export async function renameList(deps: ScreenDeps, id: string, expectedVersion: number, name: string) {
  const clean = cleanField(name, RECORD_LIMITS.listNameChars)
  if (!clean) return invalid
  return updateRecord(deps.space.lists, id, expectedVersion, deps.clock.now(), (l) => ({ ...l, name: clean }))
}

/** Deletes the list and its items. */
export async function deleteList(deps: ScreenDeps, id: string, expectedVersion: number): Promise<WriteResult<null>> {
  const result = await deleteRecord(deps.space.lists, id, expectedVersion)
  if (!result.ok) return result
  for (const item of await deps.space.listItems.list()) if (item.listId === id) await deps.space.listItems.remove(item.id)
  return result
}

export async function addListItem(deps: ScreenDeps, listId: string, text: string): Promise<WriteResult<ListItemRecord>> {
  const clean = cleanField(text, RECORD_LIMITS.itemChars)
  if (!clean || !(await deps.space.lists.get(listId))) return clean ? { ok: false, error: 'not_found' } : invalid
  const items = (await deps.space.listItems.list()).filter((i) => i.listId === listId)
  if (items.length >= RECORD_LIMITS.itemsPerList) return full
  const value = await insertRecord(deps.space.listItems, { listId, text: clean, done: false }, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' })
  return { ok: true, value }
}

export async function editListItem(deps: ScreenDeps, id: string, expectedVersion: number, text: string) {
  const clean = cleanField(text, RECORD_LIMITS.itemChars)
  if (!clean) return invalid
  return updateRecord(deps.space.listItems, id, expectedVersion, deps.clock.now(), (i) => ({ ...i, text: clean }))
}

export async function setListItemDone(deps: ScreenDeps, id: string, expectedVersion: number, done: boolean) {
  return updateRecord(deps.space.listItems, id, expectedVersion, deps.clock.now(), (i) => ({ ...i, done }))
}

export async function deleteListItem(deps: ScreenDeps, id: string, expectedVersion: number) {
  return deleteRecord(deps.space.listItems, id, expectedVersion)
}

export interface EventInput {
  title: string
  start: string
  end: string | null
  allDay: boolean
  notes: string
}

export function cleanEvent(input: EventInput): Fields<EventRecord> | null {
  const title = cleanField(input.title, RECORD_LIMITS.eventTitleChars)
  const notes = cleanField(input.notes, RECORD_LIMITS.eventNotesChars, { allowEmpty: true })
  if (!title || notes === null || !isLocalDate(input.start)) return null
  if (input.end !== null && (!isLocalDate(input.end) || input.end < input.start)) return null
  return { title, start: input.start, end: input.end, allDay: input.allDay, notes }
}

export async function createEvent(deps: ScreenDeps, input: EventInput): Promise<WriteResult<EventRecord>> {
  const fields = cleanEvent(input)
  if (!fields) return invalid
  if ((await deps.space.events.list()).length >= RECORD_LIMITS.events) return full
  return { ok: true, value: await insertRecord(deps.space.events, fields, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' }) }
}

export async function editEvent(deps: ScreenDeps, id: string, expectedVersion: number, input: EventInput) {
  const fields = cleanEvent(input)
  if (!fields) return invalid
  return updateRecord(deps.space.events, id, expectedVersion, deps.clock.now(), (e) => ({ ...e, ...fields }))
}

export async function deleteEvent(deps: ScreenDeps, id: string, expectedVersion: number) {
  return deleteRecord(deps.space.events, id, expectedVersion)
}

export interface NoteInput {
  title: string
  text: string
  subject: string | null
}

export function cleanNote(input: NoteInput): Fields<NoteRecord> | null {
  const title = cleanField(input.title, RECORD_LIMITS.noteTitleChars)
  const text = cleanField(input.text, RECORD_LIMITS.noteTextChars)
  const subject = input.subject === null ? null : cleanField(input.subject, RECORD_LIMITS.noteTitleChars)
  if (!title || !text || (input.subject !== null && !subject)) return null
  return { title, text, subject }
}

export async function createNote(deps: ScreenDeps, input: NoteInput): Promise<WriteResult<NoteRecord>> {
  const fields = cleanNote(input)
  if (!fields) return invalid
  if ((await deps.space.notes.list()).length >= RECORD_LIMITS.notes) return full
  return { ok: true, value: await insertRecord(deps.space.notes, fields, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' }) }
}

export async function editNote(deps: ScreenDeps, id: string, expectedVersion: number, input: NoteInput) {
  const fields = cleanNote(input)
  if (!fields) return invalid
  return updateRecord(deps.space.notes, id, expectedVersion, deps.clock.now(), (n) => ({ ...n, ...fields }))
}

export async function deleteNote(deps: ScreenDeps, id: string, expectedVersion: number) {
  return deleteRecord(deps.space.notes, id, expectedVersion)
}

export interface DraftInput {
  subject: string
  body: string
  recipient: string | null
}

export function cleanDraft(input: DraftInput): Fields<DraftRecord> | null {
  const subject = cleanField(input.subject, RECORD_LIMITS.draftSubjectChars)
  const body = cleanField(input.body, RECORD_LIMITS.draftBodyChars)
  const recipient = input.recipient === null ? null : cleanField(input.recipient, RECORD_LIMITS.draftRecipientChars)
  if (!subject || !body || (input.recipient !== null && !recipient)) return null
  return { subject, body, recipient }
}

export async function createDraft(deps: ScreenDeps, input: DraftInput): Promise<WriteResult<DraftRecord>> {
  const fields = cleanDraft(input)
  if (!fields) return invalid
  if ((await deps.space.drafts.list()).length >= RECORD_LIMITS.drafts) return full
  return { ok: true, value: await insertRecord(deps.space.drafts, fields, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' }) }
}

export async function editDraft(deps: ScreenDeps, id: string, expectedVersion: number, input: DraftInput) {
  const fields = cleanDraft(input)
  if (!fields) return invalid
  return updateRecord(deps.space.drafts, id, expectedVersion, deps.clock.now(), (d) => ({ ...d, ...fields }))
}

export async function deleteDraft(deps: ScreenDeps, id: string, expectedVersion: number) {
  return deleteRecord(deps.space.drafts, id, expectedVersion)
}

export interface ReminderInput {
  /** Local date and time in her time zone, '2026-10-24T18:00'. */
  when: string
  text: string
  eventId: string | null
}

export function cleanReminder(input: ReminderInput, timeZone: string): Fields<ReminderRecord> | null {
  const text = cleanField(input.text, RECORD_LIMITS.reminderTextChars)
  const dueAt = localToEpoch(input.when, timeZone)
  if (!text || dueAt === null) return null
  return { dueAt, text, eventId: input.eventId, seen: false }
}

export async function createReminder(deps: ScreenDeps, input: ReminderInput): Promise<WriteResult<ReminderRecord>> {
  const fields = cleanReminder(input, deps.settings.timeZone)
  if (!fields) return invalid
  if (fields.eventId !== null && !(await deps.space.events.get(fields.eventId))) return { ok: false, error: 'not_found' }
  if ((await deps.space.reminders.list()).length >= RECORD_LIMITS.reminders) return full
  return { ok: true, value: await insertRecord(deps.space.reminders, fields, { id: deps.newId(), now: deps.clock.now(), origin: 'utilisatrice' }) }
}

/** Reminders to show when she opens the application. */
export async function dueReminders(deps: ScreenDeps): Promise<ReminderRecord[]> {
  const now = deps.clock.now()
  return (await deps.space.reminders.list()).filter((r) => !r.seen && r.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt)
}

export async function markReminderSeen(deps: ScreenDeps, id: string, expectedVersion: number) {
  return updateRecord(deps.space.reminders, id, expectedVersion, deps.clock.now(), (r) => ({ ...r, seen: true }))
}

export async function deleteReminder(deps: ScreenDeps, id: string, expectedVersion: number) {
  return deleteRecord(deps.space.reminders, id, expectedVersion)
}
