'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Eye, 
  EyeOff, 
  Save, 
  TestTube, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Info
} from 'lucide-react'

interface FacebookSettings {
  id?: string
  app_id?: string
  app_secret?: string
  oauth_redirect_uri?: string
  is_active: boolean
}

interface TestResult {
  passed: boolean
  message: string
  details?: any
}

interface TestResults {
  credentials: TestResult
  api_access: TestResult
}

export function FacebookIntegrationForm() {
  const { user, session } = useAuth()
  const [settings, setSettings] = useState<FacebookSettings>({
    is_active: true
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
    app_secret: false
  })
  
  const [testResults, setTestResults] = useState<{
    success: boolean
    tests?: TestResults
    summary?: any
    error?: string
  } | null>(null)
  
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Load current settings
  useEffect(() => {
    if (session) {
      loadSettings()
    }
  }, [session])

  const getAuthToken = async () => {
    try {
      if (!session?.access_token) {
        console.error('No valid session found')
        // Don't set error message here - let the calling function decide
        return ''
      }
      return session.access_token
    } catch (error) {
      console.error('Error getting auth token:', error)
      return ''
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      setErrorMessage('') // Clear any previous errors
      const token = await getAuthToken()
      
      // If no token, just set loading to false without showing error
      if (!token) {
        setLoading(false)
        return
      }
      
      console.log('Loading settings with token:', token.substring(0, 20) + '...')
      const response = await fetch('/api/admin/integrations/facebook', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings(data.data)
      } else {
        const error = await response.json()
        // Only show error if it's not an authentication error for initial load
        if (response.status !== 401) {
          setErrorMessage(error.error || 'Failed to load settings')
        }
      }
    } catch (error) {
      // Silent fail on initial load
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')
      
      // Validate required fields
      if (!settings.app_id || !settings.app_secret) {
        setErrorMessage('App ID and App Secret are required')
        setSaving(false)
        return
      }
      
      const token = await getAuthToken()
      
      if (!token) {
        setErrorMessage('Please sign in to save settings')
        setSaving(false)
        return
      }
      
      console.log('Saving settings with token:', token.substring(0, 20) + '...')
      const response = await fetch('/api/admin/integrations/facebook', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        setSuccessMessage('Settings saved successfully!')
        setTimeout(() => setSuccessMessage(''), 5000)
        await loadSettings()
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to save settings')
      }
    } catch (error) {
      setErrorMessage('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      setTestResults(null)
      
      const token = await getAuthToken()
      
      if (!token) {
        setTestResults({
          success: false,
          error: 'Please sign in to test connection'
        })
        setTesting(false)
        return
      }
      
      const response = await fetch('/api/admin/integrations/facebook/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      setTestResults(data)
    } catch (error) {
      setTestResults({
        success: false,
        error: 'Failed to run connectivity test'
      })
    } finally {
      setTesting(false)
    }
  }

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleInputChange = (field: keyof FacebookSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {successMessage && (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {errorMessage && (
        <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-700 dark:text-red-300">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }} className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* App ID */}
              <div>
                <Label htmlFor="app_id">Facebook App ID</Label>
                <Input
                  id="app_id"
                  type="text"
                  value={settings.app_id || ''}
                  onChange={(e) => handleInputChange('app_id', e.target.value)}
                  placeholder="Enter Facebook App ID"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get this from your Facebook App dashboard
                </p>
              </div>

              {/* App Secret */}
              <div>
                <Label htmlFor="app_secret">Facebook App Secret</Label>
                <div className="relative">
                  <Input
                    id="app_secret"
                    type={showSecrets.app_secret ? 'text' : 'password'}
                    value={settings.app_secret || ''}
                    onChange={(e) => handleInputChange('app_secret', e.target.value)}
                    placeholder="Enter App Secret"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => toggleSecretVisibility('app_secret')}
                  >
                    {showSecrets.app_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep this secret secure
                </p>
              </div>

              {/* OAuth Redirect URI */}
              <div className="md:col-span-2">
                <Label htmlFor="oauth_redirect_uri">OAuth Redirect URI</Label>
                <Input
                  id="oauth_redirect_uri"
                  type="url"
                  value={settings.oauth_redirect_uri || ''}
                  onChange={(e) => handleInputChange('oauth_redirect_uri', e.target.value)}
                  placeholder={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}/api/auth/facebook/callback`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add this URL to your Facebook App's Valid OAuth Redirect URIs
                </p>
              </div>

              {/* Active Status */}
              <div className="md:col-span-2 flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                />
                <Label htmlFor="is_active">Integration active</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </form>

      {/* Test Results */}
      {testResults && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              Test Results
            </h3>
            
            {testResults.error ? (
              <p className="text-red-600">{testResults.error}</p>
            ) : (
              <div className="space-y-3">
                {testResults.tests && Object.entries(testResults.tests).map(([key, result]) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                    {result.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium capitalize">{key.replace('_', ' ')}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{result.message}</p>
                      {result.details && (
                        <pre className="text-xs text-gray-500 mt-1 bg-white dark:bg-gray-800 p-2 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                
                {testResults.summary && (
                  <Alert className="mt-4">
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      <h4 className="font-medium">Summary</h4>
                      <p className="text-sm">
                        {testResults.summary.passed_tests} of {testResults.summary.total_tests} tests passed
                      </p>
                      <p className="text-xs mt-1">
                        Environment: {testResults.summary.environment} | 
                        API Version: {testResults.summary.api_version} |
                        Source: {testResults.summary.config_source}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}