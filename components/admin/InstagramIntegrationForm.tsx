'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  Eye, 
  EyeOff, 
  Save, 
  TestTube, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Database,
  FileText,
  Instagram,
  Settings,
  Shield,
  Globe,
  Camera,
  Film,
  Image
} from 'lucide-react'

interface InstagramSettings {
  id?: string
  app_id?: string
  app_secret?: string
  access_token?: string
  instagram_business_account_id?: string
  api_version: string
  environment: 'development' | 'production'
  is_active: boolean
  oauth_redirect_uri?: string
  webhook_url?: string
  webhook_verify_token?: string
  permissions?: string[]
  content_types?: {
    posts: boolean
    stories: boolean
    reels: boolean
    igtv: boolean
  }
  config_data?: {
    source?: string
    last_updated_by?: string
    last_updated_at?: string
  }
}

interface TestResult {
  passed: boolean
  message: string
  details?: any
}

interface TestResults {
  credentials: TestResult
  permissions: TestResult
  business_account: TestResult
  api_access: TestResult
}

export function InstagramIntegrationForm() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<InstagramSettings>({
    api_version: 'v18.0',
    environment: 'development',
    is_active: true,
    permissions: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
    content_types: {
      posts: true,
      stories: true,
      reels: true,
      igtv: false
    }
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
    app_secret: false,
    access_token: false,
    webhook_verify_token: false
  })
  
  const [testResults, setTestResults] = useState<{
    success: boolean
    tests?: TestResults
    summary?: any
    error?: string
  } | null>(null)
  
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const apiVersions = [
    'v18.0',
    'v17.0',
    'v16.0',
    'v15.0'
  ]

  const availablePermissions = [
    { id: 'instagram_basic', name: 'Instagram Basic', required: true },
    { id: 'instagram_content_publish', name: 'Content Publishing', required: true },
    { id: 'instagram_manage_insights', name: 'Manage Insights', required: false },
    { id: 'instagram_manage_comments', name: 'Manage Comments', required: false },
    { id: 'instagram_manage_messages', name: 'Manage Messages', required: false },
    { id: 'pages_show_list', name: 'Show Page List', required: true },
    { id: 'pages_read_engagement', name: 'Read Page Engagement', required: false }
  ]

  // Load current settings
  useEffect(() => {
    loadSettings()
  }, [])

  const getAuthToken = async () => {
    try {
      const { data: { session } } = await import('@/lib/supabase').then(m => m.supabase.auth.getSession())
      return session?.access_token || ''
    } catch (error) {
      console.error('Error getting auth token:', error)
      return ''
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      const response = await fetch('/api/admin/integrations/instagram', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings(data.data)
      } else {
        const error = await response.json()
        setErrorMessage(error.error || 'Failed to load settings')
      }
    } catch (error) {
      setErrorMessage('Failed to load settings')
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
      const response = await fetch('/api/admin/integrations/instagram', {
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
      const response = await fetch('/api/admin/integrations/instagram/test', {
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

  const handleInputChange = (field: keyof InstagramSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleContentTypeChange = (type: keyof InstagramSettings['content_types'], checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      content_types: {
        ...prev.content_types,
        [type]: checked
      }
    }))
  }

  const handlePermissionToggle = (permissionId: string) => {
    setSettings(prev => ({
      ...prev,
      permissions: prev.permissions?.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...(prev.permissions || []), permissionId]
    }))
  }

  if (loading) {
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

      {/* Configuration Source */}
      {settings.config_data?.source && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          {settings.config_data.source === 'database' ? (
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            Current configuration: {settings.config_data.source === 'database' ? 'Database' : 'Environment file (fallback)'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="credentials" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="content">Content Types</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }}>
          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* App ID */}
                  <div>
                    <Label htmlFor="app_id">App ID</Label>
                    <Input
                      id="app_id"
                      type="text"
                      value={settings.app_id || ''}
                      onChange={(e) => handleInputChange('app_id', e.target.value)}
                      placeholder="Enter Instagram App ID"
                      required
                    />
                  </div>

                  {/* App Secret */}
                  <div>
                    <Label htmlFor="app_secret">App Secret</Label>
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
                  </div>

                  {/* Access Token */}
                  <div className="md:col-span-2">
                    <Label htmlFor="access_token">Access Token (Long-lived)</Label>
                    <div className="relative">
                      <Textarea
                        id="access_token"
                        value={settings.access_token || ''}
                        onChange={(e) => handleInputChange('access_token', e.target.value)}
                        placeholder="Enter long-lived access token"
                        className="min-h-[80px] pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2"
                        onClick={() => toggleSecretVisibility('access_token')}
                      >
                        {showSecrets.access_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Instagram Business Account ID */}
                  <div className="md:col-span-2">
                    <Label htmlFor="instagram_business_account_id">Instagram Business Account ID</Label>
                    <Input
                      id="instagram_business_account_id"
                      type="text"
                      value={settings.instagram_business_account_id || ''}
                      onChange={(e) => handleInputChange('instagram_business_account_id', e.target.value)}
                      placeholder="Enter Instagram Business Account ID"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Required Permissions</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select the permissions your app needs for Instagram integration
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {availablePermissions.map(permission => (
                      <div key={permission.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <Switch
                            checked={settings.permissions?.includes(permission.id) || false}
                            onCheckedChange={() => handlePermissionToggle(permission.id)}
                            disabled={permission.required}
                          />
                          <div>
                            <Label className="text-sm font-medium">{permission.name}</Label>
                            <p className="text-xs text-muted-foreground">{permission.id}</p>
                          </div>
                        </div>
                        {permission.required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Content Types</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enable the content types you want to publish to Instagram
                    </p>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <Image className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">Posts</Label>
                          <p className="text-xs text-muted-foreground">Regular feed posts</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.content_types?.posts || false}
                        onCheckedChange={(checked) => handleContentTypeChange('posts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <Camera className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">Stories</Label>
                          <p className="text-xs text-muted-foreground">24-hour stories</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.content_types?.stories || false}
                        onCheckedChange={(checked) => handleContentTypeChange('stories', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <Film className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">Reels</Label>
                          <p className="text-xs text-muted-foreground">Short-form videos</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.content_types?.reels || false}
                        onCheckedChange={(checked) => handleContentTypeChange('reels', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <Film className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">IGTV</Label>
                          <p className="text-xs text-muted-foreground">Long-form videos</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.content_types?.igtv || false}
                        onCheckedChange={(checked) => handleContentTypeChange('igtv', checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* API Version */}
                <div>
                  <Label htmlFor="api_version">API Version</Label>
                  <Select
                    value={settings.api_version}
                    onValueChange={(value) => handleInputChange('api_version', value)}
                  >
                    <SelectTrigger id="api_version">
                      <SelectValue placeholder="Select API version" />
                    </SelectTrigger>
                    <SelectContent>
                      {apiVersions.map(version => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Environment */}
                <div>
                  <Label>Environment</Label>
                  <RadioGroup
                    value={settings.environment}
                    onValueChange={(value) => handleInputChange('environment', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="development" id="development" />
                      <Label htmlFor="development">Development</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="production" id="production" />
                      <Label htmlFor="production">Production</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* OAuth Redirect URI */}
                <div>
                  <Label htmlFor="oauth_redirect_uri">OAuth Redirect URI</Label>
                  <Input
                    id="oauth_redirect_uri"
                    type="url"
                    value={settings.oauth_redirect_uri || ''}
                    onChange={(e) => handleInputChange('oauth_redirect_uri', e.target.value)}
                    placeholder={`${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/auth/instagram/callback`}
                  />
                </div>

                {/* Webhook URL */}
                <div>
                  <Label htmlFor="webhook_url">Webhook URL (optional)</Label>
                  <Input
                    id="webhook_url"
                    type="url"
                    value={settings.webhook_url || ''}
                    onChange={(e) => handleInputChange('webhook_url', e.target.value)}
                    placeholder="https://yourdomain.com/webhooks/instagram"
                  />
                </div>

                {/* Webhook Verify Token */}
                <div>
                  <Label htmlFor="webhook_verify_token">Webhook Verify Token</Label>
                  <div className="relative">
                    <Input
                      id="webhook_verify_token"
                      type={showSecrets.webhook_verify_token ? 'text' : 'password'}
                      value={settings.webhook_verify_token || ''}
                      onChange={(e) => handleInputChange('webhook_verify_token', e.target.value)}
                      placeholder="Enter webhook verify token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => toggleSecretVisibility('webhook_verify_token')}
                    >
                      {showSecrets.webhook_verify_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={settings.is_active}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Integration active</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
      </Tabs>

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