import { useTranslations } from 'next-intl';

// Centralized hook for accessing all translation namespaces
export function useAppTranslations() {
  return {
    common: useTranslations('common'),
    auth: useTranslations('auth'),
    dashboard: useTranslations('dashboard'),
    analytics: useTranslations('analytics'),
    tiktok: useTranslations('tiktok'),
    validation: useTranslations('validation'),
    errors: useTranslations('errors')
  };
}

// Individual namespace hooks for better tree-shaking
export function useCommonTranslations() {
  return useTranslations('common');
}

export function useAuthTranslations() {
  return useTranslations('auth');
}

export function useDashboardTranslations() {
  return useTranslations('dashboard');
}

export function useAnalyticsTranslations() {
  return useTranslations('analytics');
}

export function useTikTokTranslations() {
  return useTranslations('tiktok');
}

export function useValidationTranslations() {
  return useTranslations('validation');
}

export function useErrorTranslations() {
  return useTranslations('errors');
}