'use client';

import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from "@/lib/supabase-auth-helpers";
import { ThemeProvider } from "@/components/theme-provider";

interface ClientProvidersProps {
  children: React.ReactNode;
  messages: Record<string, any>;
  locale: string;
}

export function ClientProviders({ children, messages, locale }: ClientProvidersProps) {
  // Debug: check what we're receiving
  console.log('ClientProviders received:', { locale, messagesType: typeof messages, childrenType: typeof children });
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextIntlClientProvider messages={messages} locale={locale}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}