"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { useEffect, useState } from "react"

export function AuthDebug() {
  const { user, session, loading } = useAuth()
  const [logs, setLogs] = useState<string[]>([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const addLog = (message: string) => {
      // Use a stable timestamp format to avoid hydration mismatches
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const seconds = now.getSeconds().toString().padStart(2, '0')
      const timestamp = `${hours}:${minutes}:${seconds}`
      
      setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`])
    }

    addLog(`Loading: ${loading}, User: ${user?.email || 'none'}, Session: ${session ? 'exists' : 'none'}`)
    
    // Check for hash tokens only after mount
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      if (accessToken) {
        addLog(`Found access_token in URL hash: ${accessToken.substring(0, 20)}...`)
      }
    }
  }, [user, session, loading, isMounted])

  // AuthDebug disabled
  return null

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded text-xs max-w-md max-h-40 overflow-y-auto">
      <div className="font-bold mb-2">Auth Debug</div>
      {logs.map((log, i) => (
        <div key={i} className="mb-1">{log}</div>
      ))}
    </div>
  )
}