'use client';

import { COOKIE_NAME, SupportedLocale } from './locale-shared';

/**
 * Client-side locale setting using document.cookie
 * Safe to use in client components
 */
export function setUserLocaleClient(locale: SupportedLocale) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; expires=${expires}; SameSite=Lax${secure}`;
  
  // Reload the page to apply new locale
  window.location.reload();
}

/**
 * Get current locale from client-side cookie
 * Safe to use in client components
 */
export function getCurrentLocaleClient(): SupportedLocale | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const localeCookie = cookies.find(cookie => 
    cookie.trim().startsWith(`${COOKIE_NAME}=`)
  );
  
  if (localeCookie) {
    const locale = localeCookie.split('=')[1].trim();
    return locale as SupportedLocale;
  }
  
  return null;
}