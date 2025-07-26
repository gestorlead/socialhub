'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setUserLocaleClient } from '@/lib/locale-client';
import { 
  getSupportedLocales, 
  type SupportedLocale 
} from '@/lib/locale-shared';
import { updateUserLanguagePreference } from '@/lib/user-preferences';
import { useAuth } from '@/lib/supabase-auth-helpers';
import { useState } from 'react';

interface LanguageSelectorProps {
  variant?: 'select' | 'dropdown';
  className?: string;
  showLabel?: boolean;
}

export function LanguageSelector({ 
  variant = 'dropdown',
  className = '',
  showLabel = false 
}: LanguageSelectorProps) {
  const t = useTranslations('common');
  const locale = useLocale() as SupportedLocale;
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const supportedLocales = getSupportedLocales();
  const currentLocale = supportedLocales.find(l => l.code === locale);

  const handleLanguageChange = async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;
    
    setIsUpdating(true);
    
    try {
      // Update user preference in database if logged in
      if (user) {
        await updateUserLanguagePreference(user.id, newLocale);
      } else {
        // Just update client-side cookie for non-logged users
        setUserLocaleClient(newLocale);
      }
    } catch (error) {
      console.error('Failed to update language preference:', error);
      // Still update client-side as fallback
      setUserLocaleClient(newLocale);
    } finally {
      setIsUpdating(false);
    }
  };

  if (variant === 'select') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <label className="text-sm font-medium">
            {t('languages.label', { default: 'Language' })}
          </label>
        )}
        <Select 
          value={locale} 
          onValueChange={handleLanguageChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span>{currentLocale?.flag}</span>
                <span>{currentLocale?.name}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {supportedLocales.map((localeOption) => (
              <SelectItem key={localeOption.code} value={localeOption.code}>
                <div className="flex items-center gap-2">
                  <span>{localeOption.flag}</span>
                  <span>{localeOption.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 ${className}`}
          disabled={isUpdating}
        >
          <Globe className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">
            {currentLocale?.flag} {showLabel && currentLocale?.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {supportedLocales.map((localeOption) => (
          <DropdownMenuItem
            key={localeOption.code}
            onClick={() => handleLanguageChange(localeOption.code)}
            className={`flex items-center gap-2 ${
              localeOption.code === locale ? 'bg-accent' : ''
            }`}
          >
            <span>{localeOption.flag}</span>
            <span>{localeOption.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact version for space-constrained areas
export function CompactLanguageSelector({ className = '' }: { className?: string }) {
  return (
    <LanguageSelector 
      variant="dropdown" 
      className={className}
      showLabel={false}
    />
  );
}

// Full version with label for settings pages
export function FullLanguageSelector({ className = '' }: { className?: string }) {
  return (
    <LanguageSelector 
      variant="select" 
      className={className}
      showLabel={true}
    />
  );
}