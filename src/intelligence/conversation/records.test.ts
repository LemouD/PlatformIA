import { describe, expect, it } from 'vitest'
import { MemoryPrivateSpace } from '../testing/conversation-ports'
import { FakeClock, sequentialIds } from '../testing/memory-ports'
import {
  addListItem,
  createEvent,
  createList,
  createReminder,
  deleteList,
  dueReminders,
  editNote,
  isLocalDate,
  localToEpoch,
  markReminderSeen,
  setListItemDone,
  type ScreenDeps,
} from './records'

const PARIS = 'Europe/Paris'

function setup(): ScreenDeps & { space: MemoryPrivateSpace; clock: FakeClock } {
  return { space: new MemoryPrivateSpace(), clock: new FakeClock(Date.UTC(2026, 9, 24, 10, 0)), newId: sequentialIds('r'), settings: { timeZone: PARIS } }
}

describe('local dates', () => {
  it('accepts real days and times only', () => {
    expect(isLocalDate('2026-10-20')).toBe(true)
    expect(isLocalDate('2026-10-20T09:30')).toBe(true)
    expect(isLocalDate('2026-02-30')).toBe(false)
    expect(isLocalDate('2026-10-20T24:00')).toBe(false)
    expect(isLocalDate('20/10/2026')).toBe(false)
  })

  it('computes the instant in her time zone, around the October change', () => {
    // Saturday 24 October 2026 is still summer time (UTC+2); Sunday 25 is winter time (UTC+1).
    expect(localToEpoch('2026-10-24T09:00', PARIS)).toBe(Date.UTC(2026, 9, 24, 7, 0))
    expect(localToEpoch('2026-10-25T09:00', PARIS)).toBe(Date.UTC(2026, 9, 25, 8, 0))
    // 02:30 happens twice that night: the first occurrence is taken.
    expect(localToEpoch('2026-10-25T02:30', PARIS)).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })

  it('moves a time skipped in March forward by the gap', () => {
    expect(localToEpoch('2026-03-29T02:30', PARIS)).toBe(Date.UTC(2026, 2, 29, 1, 30))
    expect(localToEpoch('2026-03-29T03:30', PARIS)).toBe(Date.UTC(2026, 2, 29, 1, 30))
  })

  it('does not depend on the server time zone', () => {
    expect(localToEpoch('2026-10-25T09:00', 'America/New_York')).toBe(Date.UTC(2026, 9, 25, 13, 0))
    expect(localToEpoch('2026-10-25T09:00', 'UTC')).toBe(Date.UTC(2026, 9, 25, 9, 0))
  })
})

describe('screen functions', () => {
  it('sets the origin and versions, and refuses a stale version', async () => {
    const deps = setup()
    const list = await createList(deps, 'Courses')
    if (!list.ok) throw new Error('list')
    expect(list.value).toMatchObject({ kind: 'courses', origin: 'utilisatrice', version: 1 })
    const item = await addListItem(deps, list.value.id, 'Lait')
    if (!item.ok) throw new Error('item')
    expect(await setListItemDone(deps, item.value.id, 9, true)).toEqual({ ok: false, error: 'conflict' })
    expect((await setListItemDone(deps, item.value.id, 1, true)).ok).toBe(true)
  })

  it('deletes a list with its items', async () => {
    const deps = setup()
    const list = await createList(deps, 'Idées')
    if (!list.ok) throw new Error('list')
    await addListItem(deps, list.value.id, 'Voyage')
    expect(await deleteList(deps, list.value.id, 1)).toEqual({ ok: true, value: null })
    expect(await deps.space.listItems.list()).toHaveLength(0)
  })

  it('keeps an external origin when she edits the record', async () => {
    const deps = setup()
    await deps.space.notes.insert({ id: 'n1', origin: 'externe', createdAt: 1, updatedAt: 1, version: 1, title: 'Lettre', text: 'Texte', subject: null })
    const edited = await editNote(deps, 'n1', 1, { title: 'Lettre', text: 'Texte retouché', subject: null })
    expect(edited.ok && edited.value.origin).toBe('externe')
  })

  it('refuses an event with an end before its start', async () => {
    const deps = setup()
    expect(await createEvent(deps, { title: 'Dentiste', start: '2026-10-26T10:00', end: '2026-10-26T09:00', allDay: false, notes: '' })).toEqual({
      ok: false,
      error: 'invalid_input',
    })
  })

  it('shows a reminder set the day before the time change at the right instant, then marks it seen', async () => {
    const deps = setup()
    const reminder = await createReminder(deps, { when: '2026-10-25T09:00', text: 'Appeler maman', eventId: null })
    if (!reminder.ok) throw new Error('reminder')
    expect(reminder.value.dueAt).toBe(Date.UTC(2026, 9, 25, 8, 0))
    deps.clock.advance(Date.UTC(2026, 9, 25, 7, 59) - deps.clock.now())
    expect(await dueReminders(deps)).toHaveLength(0)
    deps.clock.advance(60_000)
    expect((await dueReminders(deps)).map((r) => r.text)).toEqual(['Appeler maman'])
    await markReminderSeen(deps, reminder.value.id, 1)
    expect(await dueReminders(deps)).toHaveLength(0)
  })
})
