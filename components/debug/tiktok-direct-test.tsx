'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

export function TikTokDirectTest() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const { getConnection } = useSocialConnections()

  const runDirectTest = async () => {
    setLoading(true)
    setResults(null)
    
    try {
      const tiktokConnection = getConnection('tiktok')
      const platformUserId = tiktokConnection?.profile_data?.open_id

      if (!platformUserId || !session?.access_token) {
        setResults({
          error: 'Missing platform user ID or access token',
          platformUserId,
          hasAccessToken: !!session?.access_token
        })
        return
      }

      const response = await fetch(`/api/test/tiktok-direct?platform_user_id=${platformUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      const data = await response.json()
      setResults(data)

    } catch (error) {
      setResults({
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm">🧪 TikTok Direct API Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDirectTest} 
          disabled={loading}
          size="sm"
          variant="secondary"
        >
          {loading ? 'Testing...' : 'Run Direct TikTok API Test'}
        </Button>
        
        {results && (
          <div className="bg-gray-100 p-3 rounded text-xs font-mono max-h-96 overflow-y-auto space-y-2">
            <div className="font-bold mb-2">🔍 Test Results:</div>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}