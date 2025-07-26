import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt', 'en', 'es', 'ja', 'zh-CN', 'zh-TW', 'ko'],
  defaultLocale: 'pt',
  localePrefix: 'never' // Don't prefix URLs with locale
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);