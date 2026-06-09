import { create } from 'zustand'
import { de, type TranslationKey } from './de.js'
import { ar } from './ar.js'

export type Language = 'de' | 'ar'

const STORAGE_KEY = 'concordia_terminal_lang'

const dictionaries = { de, ar }

interface I18nState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string>) => string
}

function loadLanguage(): Language {
  if (typeof window === 'undefined') return 'de'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'ar' ? 'ar' : 'de'
}

function applyDocumentDirection(lang: Language) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

applyDocumentDirection(loadLanguage())

export const useI18n = create<I18nState>((set, get) => ({
  language: loadLanguage(),
  setLanguage: (language) => {
    window.localStorage.setItem(STORAGE_KEY, language)
    applyDocumentDirection(language)
    set({ language })
  },
  t: (key, vars) => {
    const lang = get().language
    let text = dictionaries[lang][key] ?? dictionaries.de[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  },
}))
