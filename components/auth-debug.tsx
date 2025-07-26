"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { useAuthSession } from "@/hooks/use-auth-session"
import { useEffect, useState } from "react"

export function AuthDebug() {
  const { user, session: authSession, loading: authLoading } = useAuth()
  const { session: sessionHookSession, loading: sessionLoading, isAuthenticated, isReady } = useAuthSession()
  const [logs, setLogs] = useState<string[]>([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const addLog = (message: string) => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const seconds = now.getSeconds().toString().padStart(2, '0')
      const timestamp = `${hours}:${minutes}:${seconds}`
      
      setLogs(prev => [...prev.slice(-12), `[${timestamp}] ${message}`])
    }

    addLog(`Auth: loading=${authLoading}, user=${user?.email || 'none'}, session=${authSession ? 'exists' : 'none'}`)
    addLog(`Session Hook: loading=${sessionLoading}, ready=${isReady}, auth=${isAuthenticated}`)
    
    // Check for hash tokens only after mount
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      if (accessToken) {
        addLog(`Hash token: ${accessToken.substring(0, 15)}...`)
      }
    }
  }, [user, authSession, authLoading, sessionHookSession, sessionLoading, isAuthenticated, isReady, isMounted])

  // AuthDebug enabled for debugging persistent issue
  if (!isMounted) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded text-xs max-w-md max-h-40 overflow-y-auto">
      <div className="font-bold mb-2">Auth Debug</div>
      {logs.map((log, i) => (
        <div key={i} className="mb-1">{log}</div>
      ))}
    </div>
  )
}