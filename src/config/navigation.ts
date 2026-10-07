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
