const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

export function formatCompactNumber(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}K`
  return `${trimDecimal(value / 1_000_000)}M`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function formatHeadingDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()]
  const month = MONTHS[date.getMonth()]
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  return `${weekday} · ${pad2(date.getDate())} ${month} · ${time}`
}
