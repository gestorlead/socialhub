/**
 * Locale utilities - Re-exports for backward compatibility
 * 
 * IMPORTANT: This file re-exports from different modules based on usage:
 * - Client components should import from './locale-client' or './locale-shared'
 * - Server components should import from './locale-server' or './locale-shared'
 * - This file maintains backward compatibility but avoid using it in new code
 */

// Re-export shared utilities (safe for both client and server)
export {
  type SupportedLocale,
  COOKIE_NAME,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isValidLocale,
  getLocaleDisplayName,
  getLocaleFlag,
  getSupportedLocales,
  isCJKLocale,
  getLocaleDirection
} from './locale-shared';

// Re-export client utilities
export { setUserLocaleClient, getCurrentLocaleClient } from './locale-client';

// Server utilities - these will cause hydration errors if used in client components
// Import them directly from './locale-server' in server components
export { getUserLocale, setUserLocale } from './locale-server';