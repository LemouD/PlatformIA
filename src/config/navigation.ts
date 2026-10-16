export interface NavItem {
  label: string
  href: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Command Center', href: '/' },
  { label: 'Agents', href: '/agents' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Memory', href: '/memory' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Tools', href: '/tools' },
  { label: 'Logs', href: '/logs' },
]

/** Tabs of the phone tab bar; the last slot is the "More" sheet. */
export const MOBILE_TABS: readonly NavItem[] = [
  { label: 'Command', href: '/' },
  { label: 'Agents', href: '/agents' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Logs', href: '/logs' },
]

/** Sections reached through the "More" sheet on phones. */
export const MORE_ITEMS: readonly NavItem[] = [
  { label: 'Memory', href: '/memory' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Tools', href: '/tools' },
]

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The "More" tab is highlighted when the current page lives in its sheet. */
export function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => isNavItemActive(pathname, item.href))
}

/** Link to an agent's page. The id is encoded: one from an external agent may hold /, ?, # or %. */
export function agentHref(agentId: string): string {
  return `/agents/${encodeURIComponent(agentId)}`
}

/** Reads the id back from the URL segment, which Next hands over still encoded; null when malformed. */
export function decodeAgentId(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}
