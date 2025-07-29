'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ConnectionDebug() {
  const { user } = useAuth()
  const { connections, isConnected, getConnection, loading } = useSocialConnections()
  const [debugData, setDebugData] = useState<any>(null)
  const [debugLoading, setDebugLoading] = useState(false)

  const runDebug = async () => {
    if (!user) return
    
    setDebugLoading(true)
    try {
      const response = await fetch(`/api/debug/social-connections?user_id=${user.id}`)
      const data = await response.json()
      setDebugData(data)
    } catch (error) {
      console.error('Debug error:', error)
    } finally {
      setDebugLoading(false)
    }
  }

  const tiktokConnection = getConnection('tiktok')

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Debug - Conexões Sociais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Hook State</h3>
            <div className="bg-gray-100 p-3 rounded text-sm">
              <p><strong>Loading:</strong> {loading.toString()}</p>
              <p><strong>Connections Count:</strong> {connections.length}</p>
              <p><strong>isConnected('tiktok'):</strong> {isConnected('tiktok').toString()}</p>
              <p><strong>TikTok Connection:</strong> {tiktokConnection ? 'Found' : 'Not found'}</p>
              {tiktokConnection && (
                <>
                  <p><strong>Platform User ID:</strong> {tiktokConnection.platform_user_id}</p>
                  <p><strong>Has Access Token:</strong> {!!tiktokConnection.access_token}</p>
                  <p><strong>Scope:</strong> {tiktokConnection.scope}</p>
                  <p><strong>Expires At:</strong> {tiktokConnection.expires_at}</p>
                </>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">User Info</h3>
            <div className="bg-gray-100 p-3 rounded text-sm">
              <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
              <p><strong>User Email:</strong> {user?.email || 'N/A'}</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={runDebug} 
          disabled={!user || debugLoading}
          className="w-full"
        >
          {debugLoading ? 'Executando Debug...' : 'Executar Debug da API'}
        </Button>

        {debugData && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Debug da API</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}