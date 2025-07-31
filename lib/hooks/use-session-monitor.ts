'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

interface SessionMonitorOptions {
  onSessionLoss?: () => void;
  onSessionRestore?: () => void;
  checkInterval?: number; // in milliseconds
}

export function useSessionMonitor({
  onSessionLoss,
  onSessionRestore,
  checkInterval = 30000 // 30 seconds
}: SessionMonitorOptions = {}) {
  const lastSessionState = useRef<boolean | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        const session = user ? { user } : null;
        const hasSession = !!session && !error;

        // Log session state changes
        if (lastSessionState.current !== null && lastSessionState.current !== hasSession) {
          console.log('🔄 Session state changed:', {
            from: lastSessionState.current ? 'authenticated' : 'unauthenticated',
            to: hasSession ? 'authenticated' : 'unauthenticated',
            timestamp: new Date().toISOString(),
            error: error?.message
          });

          if (lastSessionState.current && !hasSession) {
            // Session was lost
            console.warn('⚠️ Session lost unexpectedly');
            onSessionLoss?.();
          } else if (!lastSessionState.current && hasSession) {
            // Session was restored
            console.log('✅ Session restored');
            onSessionRestore?.();
          }
        }

        lastSessionState.current = hasSession;

        // Log cookie state for debugging
        if (process.env.NODE_ENV === 'development') {
          const cookieState = document.cookie
            .split(';')
            .filter(cookie => cookie.includes('supabase') || cookie.includes('sb-'))
            .map(cookie => cookie.trim());
          
          if (cookieState.length === 0) {
            console.warn('🍪 No Supabase cookies found in browser');
          } else {
            console.log('🍪 Supabase cookies present:', cookieState.length);
          }
        }

      } catch (error) {
        console.error('Session check failed:', error);
      }
    };

    // Initial check
    checkSession();

    // Set up interval
    intervalRef.current = setInterval(checkSession, checkInterval);

    // Listen to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth event:', event, {
        hasSession: !!session,
        userEmail: session?.user?.email,
        timestamp: new Date().toISOString()
      });
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      listener.subscription.unsubscribe();
    };
  }, [onSessionLoss, onSessionRestore, checkInterval]);

  return {
    checkSession: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      const session = user ? { user } : null;
      return { session, error };
    }
  };
}