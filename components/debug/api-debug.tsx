'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

export function ApiDebug() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const { getConnection } = useSocialConnections()

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testApiCall = async () => {
    setLoading(true)
    setLogs([])
    
    try {
      const tiktokConnection = getConnection('tiktok')
      const platformUserId = tiktokConnection?.profile_data?.open_id

      addLog(`Platform User ID: ${platformUserId}`)
      addLog(`Session exists: ${!!session}`)
      addLog(`Access token exists: ${!!session?.access_token}`)

      if (!platformUserId) {
        addLog('ERROR: No platform user ID found')
        return
      }

      if (!session?.access_token) {
        addLog('ERROR: No access token found')
        return
      }

      addLog(`Making request to /api/social/tiktok/videos`)
      addLog(`Request method: GET`)

      const params = new URLSearchParams({
        platform_user_id: platformUserId,
        max_count: '5'
      })

      const response = await fetch(`/api/social/tiktok/videos?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      addLog(`Response status: ${response.status} ${response.statusText}`)
      addLog(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

      const text = await response.text()
      addLog(`Response text (first 500 chars): ${text.substring(0, 500)}`)

      if (text) {
        try {
          const json = JSON.parse(text)
          addLog(`Parsed JSON: ${JSON.stringify(json, null, 2)}`)
        } catch (e) {
          addLog(`JSON parse error: ${e}`)
        }
      } else {
        addLog('Response is empty')
      }

    } catch (error) {
      addLog(`Fetch error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm">🔧 API Debug Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testApiCall} 
          disabled={loading}
          size="sm"
        >
          {loading ? 'Testing...' : 'Test TikTok Videos API'}
        </Button>
        
        {logs.length > 0 && (
          <div className="bg-gray-100 p-3 rounded text-xs font-mono max-h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}