'use client';

import { AuthProvider } from "@/lib/supabase-auth-helpers";
import { ThemeProvider } from "@/components/theme-provider";
import { NextIntlClientProvider } from 'next-intl';

interface ProvidersProps {
  children: React.ReactNode;
  messages: Record<string, any>;
}

export function Providers({ children, messages }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NextIntlClientProvider messages={messages}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}