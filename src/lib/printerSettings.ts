const STORAGE_KEY = 'concordia_printer_network'

export type NetworkPrinterSettings = {
  host: string
  port: number
  enabled: boolean
}

const DEFAULT: NetworkPrinterSettings = {
  host: '',
  port: 9100,
  enabled: false,
}

export function getNetworkPrinterSettings(): NetworkPrinterSettings {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<NetworkPrinterSettings>
    return {
      host: String(parsed.host ?? '').trim(),
      port: Number(parsed.port ?? 9100) || 9100,
      enabled: Boolean(parsed.enabled),
    }
  } catch {
    return DEFAULT
  }
}

export function saveNetworkPrinterSettings(settings: NetworkPrinterSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
