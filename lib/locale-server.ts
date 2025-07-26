import { cookies, headers } from 'next/headers';
import { COOKIE_NAME, DEFAULT_LOCALE, SUPPORTED_LOCALES, SupportedLocale } from './locale-shared';

/**
 * Server-side locale detection using cookies and headers
 * Only use this in Server Components, API routes, or middleware
 */
export async function getUserLocale(): Promise<SupportedLocale> {
  // 1. Check user preference cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(COOKIE_NAME)?.value;
  
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)) {
    return cookieLocale as SupportedLocale;
  }
  
  // 2. Check browser accept-language header
  try {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    
    if (acceptLanguage) {
      const detectedLocale = detectLocaleFromHeader(acceptLanguage);
      if (detectedLocale) {
        return detectedLocale;
      }
    }
  } catch (error) {
    console.warn('Failed to detect locale from headers:', error);
  }
  
  // 3. Fallback to default Portuguese
  return DEFAULT_LOCALE;
}

/**
 * Server-side locale setting using cookies
 * Only use this in Server Actions or API routes
 */
export async function setUserLocale(locale: SupportedLocale) {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, locale, {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
}

/**
 * Detect locale from accept-language header
 */
function detectLocaleFromHeader(acceptLanguage: string): SupportedLocale | null {
  const locales = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, quality = '1'] = lang.trim().split(';q=');
      return {
        locale: locale.trim().toLowerCase(),
        quality: parseFloat(quality)
      };
    })
    .sort((a, b) => b.quality - a.quality);
  
  for (const { locale } of locales) {
    // Check exact match
    if (SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      return locale as SupportedLocale;
    }
    
    // Check language match (e.g., 'en-US' -> 'en')
    const languageCode = locale.split('-')[0];
    if (SUPPORTED_LOCALES.includes(languageCode as SupportedLocale)) {
      return languageCode as SupportedLocale;
    }
    
    // Special handling for Chinese variants
    if (locale.startsWith('zh')) {
      if (locale.includes('tw') || locale.includes('hk') || locale.includes('mo')) {
        return 'zh-TW';
      } else {
        return 'zh-CN';
      }
    }
  }
  
  return null;
}