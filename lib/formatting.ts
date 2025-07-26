import { useFormatter, useLocale } from 'next-intl';
import { formatCJKNumber, isCJKLocale } from './cjk-utils';
import { type SupportedLocale } from './locale-shared';

// Enhanced formatter hook with CJK support
export function useAppFormatter() {
  const format = useFormatter();
  const locale = useLocale() as SupportedLocale;
  
  return {
    // Date and time formatting
    dateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return format.dateTime(dateObj, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...options
      });
    },

    // Short date format
    dateShort: (date: Date | string | number) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return format.dateTime(dateObj, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    },

    // Time only
    time: (date: Date | string | number) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return format.dateTime(dateObj, {
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // Relative time (e.g., "2 hours ago")
    relativeTime: (date: Date | string | number) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return format.relativeTime(dateObj);
    },

    // Number formatting with CJK support
    number: (num: number, options?: Intl.NumberFormatOptions) => {
      if (isCJKLocale(locale) && !options?.style) {
        return formatCJKNumber(num, locale);
      }
      
      return format.number(num, {
        notation: num >= 1000000 ? 'compact' : 'standard',
        ...options
      });
    },

    // Compact number format (e.g., 1.2K, 1.5M)
    numberCompact: (num: number) => {
      if (isCJKLocale(locale)) {
        return formatCJKNumber(num, locale);
      }
      
      return format.number(num, {
        notation: 'compact',
        compactDisplay: 'short'
      });
    },

    // Currency formatting
    currency: (amount: number, currency = 'BRL', options?: Intl.NumberFormatOptions) => {
      return format.number(amount, {
        style: 'currency',
        currency,
        ...options
      });
    },

    // Percentage formatting
    percentage: (value: number, options?: Intl.NumberFormatOptions) => {
      return format.number(value / 100, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
        ...options
      });
    },

    // Social media metrics formatting
    socialMetric: (num: number, includeLabel = false) => {
      const formatted = isCJKLocale(locale) 
        ? formatCJKNumber(num, locale)
        : format.number(num, { notation: 'compact', compactDisplay: 'short' });
      
      if (!includeLabel) return formatted;
      
      // This would typically use translations for labels
      return formatted;
    },

    // Duration formatting (e.g., "2:30" for 2 minutes 30 seconds)
    duration: (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      
      if (minutes === 0) {
        return `0:${remainingSeconds.toString().padStart(2, '0')}`;
      }
      
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    },

    // File size formatting
    fileSize: (bytes: number) => {
      const sizes = ['B', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 B';
      
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      const size = bytes / Math.pow(1024, i);
      
      return `${size.toFixed(1)} ${sizes[i]}`;
    },

    // List formatting (e.g., "A, B, and C")
    list: (items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') => {
      return format.list(items, { type });
    }
  };
}

// Server-side formatting utilities
export async function getServerFormatter(locale: SupportedLocale) {
  // This would be used in server components
  // Implementation would depend on server-side i18n setup
  return {
    formatNumber: (num: number) => {
      if (isCJKLocale(locale)) {
        return formatCJKNumber(num, locale);
      }
      return new Intl.NumberFormat(locale).format(num);
    },
    
    formatDate: (date: Date) => {
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    }
  };
}

// Utility for formatting social media growth percentages
export function formatGrowthPercentage(current: number, previous: number): {
  value: number;
  formatted: string;
  isPositive: boolean;
} {
  if (previous === 0) {
    return {
      value: current > 0 ? 100 : 0,
      formatted: current > 0 ? '+100%' : '0%',
      isPositive: current > 0
    };
  }
  
  const percentage = ((current - previous) / previous) * 100;
  const isPositive = percentage >= 0;
  const sign = isPositive ? '+' : '';
  
  return {
    value: percentage,
    formatted: `${sign}${percentage.toFixed(1)}%`,
    isPositive
  };
}

// Utility for formatting engagement rates
export function formatEngagementRate(
  engagements: number, 
  impressions: number
): string {
  if (impressions === 0) return '0%';
  
  const rate = (engagements / impressions) * 100;
  return `${rate.toFixed(2)}%`;
}