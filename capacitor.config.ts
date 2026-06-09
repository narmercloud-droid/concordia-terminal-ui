import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'de.concordia.terminal',
  appName: 'Concordia Terminal',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Native HTTP bypasses WebView CORS (required on Z91 / Capacitor https://localhost origin).
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
