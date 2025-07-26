// Shared constants and types for both server and client components

export const COOKIE_NAME = 'PREFERRED_LOCALE';
export const DEFAULT_LOCALE = 'pt';
export const SUPPORTED_LOCALES = ['pt', 'en', 'es', 'ja', 'zh-CN', 'zh-TW', 'ko'] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Validate if locale is supported
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

// Get locale display name
export function getLocaleDisplayName(locale: SupportedLocale): string {
  const displayNames: Record<SupportedLocale, string> = {
    'pt': 'Português',
    'en': 'English',
    'es': 'Español',
    'ja': '日本語',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'ko': '한국어'
  };
  
  return displayNames[locale];
}

// Get locale flag emoji
export function getLocaleFlag(locale: SupportedLocale): string {
  const flags: Record<SupportedLocale, string> = {
    'pt': '🇧🇷',
    'en': '🇺🇸',
    'es': '🇪🇸',
    'ja': '🇯🇵',
    'zh-CN': '🇨🇳',
    'zh-TW': '🇹🇼',
    'ko': '🇰🇷'
  };
  
  return flags[locale];
}

// Get all supported locales with metadata
export function getSupportedLocales() {
  return SUPPORTED_LOCALES.map(locale => ({
    code: locale,
    name: getLocaleDisplayName(locale),
    flag: getLocaleFlag(locale)
  }));
}

// Check if locale requires CJK font support
export function isCJKLocale(locale: SupportedLocale): boolean {
  return ['ja', 'zh-CN', 'zh-TW', 'ko'].includes(locale);
}

// Get text direction for locale (future RTL support)
export function getLocaleDirection(locale: SupportedLocale): 'ltr' | 'rtl' {
  // All current locales are LTR, but this can be extended for RTL languages
  return 'ltr';
}