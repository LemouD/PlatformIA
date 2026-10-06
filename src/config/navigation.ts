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

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
