const BERLIN_TZ = 'Europe/Berlin'

export function berlinYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TZ }).format(date)
}

export function berlinDayStartUtc(ymd: string): Date {
  let probe = new Date(`${ymd}T12:00:00Z`)
  for (let i = 0; i < 72; i++) {
    const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TZ }).format(probe)
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: BERLIN_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(probe)
    if (datePart === ymd && timePart === '00:00') return probe
    probe = new Date(probe.getTime() - 60 * 60 * 1000)
  }
  return new Date(`${ymd}T22:00:00Z`)
}

export function getBerlinTodayRange(now = new Date()) {
  const ymd = berlinYmd(now)
  const start = berlinDayStartUtc(ymd)
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TZ }).format(
    new Date(start.getTime() + 26 * 60 * 60 * 1000),
  )
  const end = berlinDayStartUtc(tomorrow)
  return { start, end, ymd }
}

export function isBerlinToday(isoDate: string, now = new Date()): boolean {
  const { start, end } = getBerlinTodayRange(now)
  const ts = new Date(isoDate).getTime()
  return ts >= start.getTime() && ts < end.getTime()
}
