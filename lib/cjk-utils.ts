import { type SupportedLocale } from './locale-shared';

// Get optimal line height for CJK languages
export function getCJKLineHeight(locale: SupportedLocale): number {
  const cjkLocales: SupportedLocale[] = ['ja', 'zh-CN', 'zh-TW', 'ko'];
  return cjkLocales.includes(locale) ? 1.7 : 1.4;
}

// Get font stack for specific locale
export function getCJKFontStack(locale: SupportedLocale): string {
  const fontStacks: Record<SupportedLocale, string> = {
    'ja': '"Hiragino Sans", "Yu Gothic UI", "Meiryo", "MS Gothic", sans-serif',
    'zh-CN': '"PingFang SC", "Microsoft YaHei", "SimSun", "Noto Sans SC", sans-serif',
    'zh-TW': '"PingFang TC", "Microsoft JhengHei", "PMingLiU", "Noto Sans TC", sans-serif',
    'ko': '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Dotum", sans-serif',
    'pt': 'system-ui, -apple-system, "Segoe UI", sans-serif',
    'en': 'system-ui, -apple-system, "Segoe UI", sans-serif',
    'es': 'system-ui, -apple-system, "Segoe UI", sans-serif'
  };
  
  return fontStacks[locale] || fontStacks['en'];
}

// Check if locale needs CJK-specific handling
export function isCJKLocale(locale: SupportedLocale): boolean {
  return ['ja', 'zh-CN', 'zh-TW', 'ko'].includes(locale);
}

// Get word break behavior for locale
export function getWordBreakBehavior(locale: SupportedLocale): 'normal' | 'break-word' | 'break-all' {
  if (isCJKLocale(locale)) {
    return 'break-word';
  }
  return 'normal';
}

// Get text overflow handling for CJK
export function getTextOverflowBehavior(locale: SupportedLocale): 'ellipsis' | 'clip' {
  // CJK languages generally work better with ellipsis
  return 'ellipsis';
}

// Generate CSS custom properties for locale
export function getLocaleCSS(locale: SupportedLocale): Record<string, string> {
  return {
    '--font-family': getCJKFontStack(locale),
    '--line-height': getCJKLineHeight(locale).toString(),
    '--word-break': getWordBreakBehavior(locale),
    '--text-overflow': getTextOverflowBehavior(locale)
  };
}

// Get optimal character limits for different locales
export function getCharacterLimits(locale: SupportedLocale) {
  // CJK characters are generally wider and convey more meaning per character
  const baseLimits = {
    shortText: 50,
    mediumText: 150,
    longText: 300,
    description: 500
  };
  
  if (isCJKLocale(locale)) {
    return {
      shortText: Math.floor(baseLimits.shortText * 0.7),
      mediumText: Math.floor(baseLimits.mediumText * 0.7),
      longText: Math.floor(baseLimits.longText * 0.7),
      description: Math.floor(baseLimits.description * 0.7)
    };
  }
  
  return baseLimits;
}

// Format numbers for CJK locales
export function formatCJKNumber(num: number, locale: SupportedLocale): string {
  if (!isCJKLocale(locale)) {
    return num.toLocaleString();
  }
  
  // Special formatting for large numbers in CJK
  if (locale === 'ja') {
    if (num >= 100000000) { // 1億
      return `${(num / 100000000).toFixed(1)}億`;
    } else if (num >= 10000) { // 1万
      return `${(num / 10000).toFixed(1)}万`;
    }
  } else if (locale.startsWith('zh')) {
    if (num >= 100000000) { // 1亿
      return `${(num / 100000000).toFixed(1)}亿`;
    } else if (num >= 10000) { // 1万
      return `${(num / 10000).toFixed(1)}万`;
    }
  } else if (locale === 'ko') {
    if (num >= 100000000) { // 1억
      return `${(num / 100000000).toFixed(1)}억`;
    } else if (num >= 10000) { // 1만
      return `${(num / 10000).toFixed(1)}만`;
    }
  }
  
  return num.toLocaleString();
}

// Get optimal input method for CJK
export function getCJKInputProps(locale: SupportedLocale) {
  if (!isCJKLocale(locale)) {
    return {};
  }
  
  const inputModeMap: Record<string, string> = {
    'ja': 'hiragana',
    'zh-CN': 'pinyin',
    'zh-TW': 'pinyin',
    'ko': 'hangul'
  };
  
  return {
    inputMode: inputModeMap[locale] || 'text',
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false
  };
}