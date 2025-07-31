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
  Facebook,
  Settings,
  Shield,
  Globe,
  Users,
  Calendar,
  Target,
  Plus,
  Trash2
} from 'lucide-react'

interface FacebookPage {
  id: string
  name: string
  access_token: string
  category: string
  is_active: boolean
}

interface FacebookSettings {
  id?: string
  app_id?: string
  app_secret?: string
  access_token?: string
  api_version: string
  environment: 'development' | 'production'
  is_active: boolean
  oauth_redirect_uri?: string
  webhook_url?: string
  webhook_verify_token?: string
  permissions?: string[]
  pages?: FacebookPage[]
  privacy_settings?: {
    default_privacy: 'PUBLIC' | 'FRIENDS' | 'ONLY_ME' | 'CUSTOM'
    allow_message_replies: boolean
    restrict_location: boolean
  }
  scheduling?: {
    enabled: boolean
    max_scheduled_posts: number
    min_schedule_minutes: number
  }
  audience_targeting?: {
    enabled: boolean
    default_age_min?: number
    default_age_max?: number
    default_countries?: string[]
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
  pages_access: TestResult
  api_access: TestResult
}

export function FacebookIntegrationForm() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<FacebookSettings>({
    api_version: 'v18.0',
    environment: 'development',
    is_active: true,
    permissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    pages: [],
    privacy_settings: {
      default_privacy: 'PUBLIC',
      allow_message_replies: true,
      restrict_location: false
    },
    scheduling: {
      enabled: true,
      max_scheduled_posts: 50,
      min_schedule_minutes: 10
    },
    audience_targeting: {
      enabled: false,
      default_age_min: 18,
      default_age_max: 65,
      default_countries: []
    }
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
    app_secret: false,
    access_token: false,
    webhook_verify_token: false,
    page_tokens: {} as Record<string, boolean>
  })
  
  const [testResults, setTestResults] = useState<{
    success: boolean
    tests?: TestResults
    summary?: any
    error?: string
  } | null>(null)
  
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [newPageForm, setNewPageForm] = useState({
    id: '',
    name: '',
    access_token: '',
    category: '',
    is_active: true
  })

  const apiVersions = [
    'v18.0',
    'v17.0',
    'v16.0',
    'v15.0'
  ]

  const availablePermissions = [
    { id: 'pages_show_list', name: 'Show Page List', required: true },
    { id: 'pages_read_engagement', name: 'Read Page Engagement', required: true },
    { id: 'pages_manage_posts', name: 'Manage Posts', required: true },
    { id: 'pages_manage_metadata', name: 'Manage Page Metadata', required: false },
    { id: 'pages_read_user_content', name: 'Read User Content', required: false },
    { id: 'pages_manage_ads', name: 'Manage Ads', required: false },
    { id: 'pages_manage_engagement', name: 'Manage Engagement', required: false },
    { id: 'pages_messaging', name: 'Page Messaging', required: false }
  ]

  const privacyOptions = [
    { value: 'PUBLIC', label: 'Public' },
    { value: 'FRIENDS', label: 'Friends' },
    { value: 'ONLY_ME', label: 'Only Me' },
    { value: 'CUSTOM', label: 'Custom' }
  ]

  // Load current settings
  useEffect(() => {
    loadSettings()
  }, [])

  const getAuthToken = async () => {
    try {
      const { data: { user }, error } = await import('@/lib/supabase').then(m => m.supabase.auth.getUser())
      const session = user ? { user } : null
      if (error) {
        console.error('Session error:', error)
        setErrorMessage('Authentication error. Please refresh and try again.')
        return ''
      }
      if (!session?.access_token) {
        console.error('No valid session found')
        setErrorMessage('No valid session. Please log in again.')
        return ''
      }
      return session.access_token
    } catch (error) {
      console.error('Error getting auth token:', error)
      setErrorMessage('Failed to authenticate. Please refresh and try again.')
      return ''
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
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

  const toggleSecretVisibility = (field: keyof typeof showSecrets, pageId?: string) => {
    if (field === 'page_tokens' && pageId) {
      setShowSecrets(prev => ({
        ...prev,
        page_tokens: {
          ...prev.page_tokens,
          [pageId]: !prev.page_tokens[pageId]
        }
      }))
    } else {
      setShowSecrets(prev => ({
        ...prev,
        [field]: !prev[field]
      }))
    }
  }

  const handleInputChange = (field: keyof FacebookSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePrivacyChange = (field: keyof FacebookSettings['privacy_settings'], value: any) => {
    setSettings(prev => ({
      ...prev,
      privacy_settings: {
        ...prev.privacy_settings,
        [field]: value
      }
    }))
  }

  const handleSchedulingChange = (field: keyof FacebookSettings['scheduling'], value: any) => {
    setSettings(prev => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        [field]: value
      }
    }))
  }

  const handleTargetingChange = (field: keyof FacebookSettings['audience_targeting'], value: any) => {
    setSettings(prev => ({
      ...prev,
      audience_targeting: {
        ...prev.audience_targeting,
        [field]: value
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

  const addPage = () => {
    if (!newPageForm.id || !newPageForm.name || !newPageForm.access_token) {
      setErrorMessage('Page ID, name, and access token are required')
      return
    }

    setSettings(prev => ({
      ...prev,
      pages: [...(prev.pages || []), newPageForm]
    }))

    // Reset form
    setNewPageForm({
      id: '',
      name: '',
      access_token: '',
      category: '',
      is_active: true
    })
  }

  const removePage = (pageId: string) => {
    setSettings(prev => ({
      ...prev,
      pages: prev.pages?.filter(p => p.id !== pageId) || []
    }))
  }

  const togglePageActive = (pageId: string) => {
    setSettings(prev => ({
      ...prev,
      pages: prev.pages?.map(p => 
        p.id === pageId ? { ...p, is_active: !p.is_active } : p
      ) || []
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
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
                      placeholder="Enter Facebook App ID"
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
                    <Label htmlFor="access_token">User Access Token</Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Textarea
                          id="access_token"
                          value={settings.access_token || ''}
                          onChange={(e) => handleInputChange('access_token', e.target.value)}
                          placeholder="Enter user access token"
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Get access token and page information through Facebook OAuth
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open('/api/auth/facebook', '_blank')}
                          className="flex items-center gap-2"
                        >
                          <Facebook className="w-4 h-4" />
                          Connect Facebook
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Facebook Pages</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add and manage Facebook pages for content publishing
                    </p>
                  </div>

                  {/* Existing Pages */}
                  {settings.pages && settings.pages.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {settings.pages.map(page => (
                        <div key={page.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center space-x-3">
                            <div>
                              <p className="font-medium">{page.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {page.id}</p>
                              {page.category && (
                                <Badge variant="secondary" className="text-xs mt-1">{page.category}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={page.is_active}
                              onCheckedChange={() => togglePageActive(page.id)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePage(page.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Page Form */}
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-3">Add New Page</h4>
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor="new_page_id">Page ID</Label>
                          <Input
                            id="new_page_id"
                            type="text"
                            value={newPageForm.id}
                            onChange={(e) => setNewPageForm(prev => ({ ...prev, id: e.target.value }))}
                            placeholder="Enter page ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new_page_name">Page Name</Label>
                          <Input
                            id="new_page_name"
                            type="text"
                            value={newPageForm.name}
                            onChange={(e) => setNewPageForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter page name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="new_page_token">Page Access Token</Label>
                        <Input
                          id="new_page_token"
                          type="password"
                          value={newPageForm.access_token}
                          onChange={(e) => setNewPageForm(prev => ({ ...prev, access_token: e.target.value }))}
                          placeholder="Enter page access token"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_page_category">Category (optional)</Label>
                        <Input
                          id="new_page_category"
                          type="text"
                          value={newPageForm.category}
                          onChange={(e) => setNewPageForm(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="e.g., Business, Media, etc."
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={addPage}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Page
                      </Button>
                    </div>
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
                      Select the permissions your app needs for Facebook integration
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

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Default Privacy */}
                <div>
                  <Label htmlFor="default_privacy">Default Privacy Setting</Label>
                  <Select
                    value={settings.privacy_settings?.default_privacy}
                    onValueChange={(value) => handlePrivacyChange('default_privacy', value)}
                  >
                    <SelectTrigger id="default_privacy">
                      <SelectValue placeholder="Select default privacy" />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Allow Message Replies */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allow_message_replies"
                    checked={settings.privacy_settings?.allow_message_replies || false}
                    onCheckedChange={(checked) => handlePrivacyChange('allow_message_replies', checked)}
                  />
                  <Label htmlFor="allow_message_replies">Allow message replies on posts</Label>
                </div>

                {/* Restrict Location */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="restrict_location"
                    checked={settings.privacy_settings?.restrict_location || false}
                    onCheckedChange={(checked) => handlePrivacyChange('restrict_location', checked)}
                  />
                  <Label htmlFor="restrict_location">Restrict location information</Label>
                </div>

                {/* Scheduling Settings */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Post Scheduling</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="scheduling_enabled"
                        checked={settings.scheduling?.enabled || false}
                        onCheckedChange={(checked) => handleSchedulingChange('enabled', checked)}
                      />
                      <Label htmlFor="scheduling_enabled">Enable post scheduling</Label>
                    </div>

                    {settings.scheduling?.enabled && (
                      <>
                        <div>
                          <Label htmlFor="max_scheduled_posts">Maximum scheduled posts</Label>
                          <Input
                            id="max_scheduled_posts"
                            type="number"
                            value={settings.scheduling?.max_scheduled_posts || 50}
                            onChange={(e) => handleSchedulingChange('max_scheduled_posts', parseInt(e.target.value))}
                            min="1"
                            max="100"
                          />
                        </div>

                        <div>
                          <Label htmlFor="min_schedule_minutes">Minimum schedule time (minutes)</Label>
                          <Input
                            id="min_schedule_minutes"
                            type="number"
                            value={settings.scheduling?.min_schedule_minutes || 10}
                            onChange={(e) => handleSchedulingChange('min_schedule_minutes', parseInt(e.target.value))}
                            min="10"
                            max="1440"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Audience Targeting */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Audience Targeting</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="targeting_enabled"
                        checked={settings.audience_targeting?.enabled || false}
                        onCheckedChange={(checked) => handleTargetingChange('enabled', checked)}
                      />
                      <Label htmlFor="targeting_enabled">Enable audience targeting</Label>
                    </div>

                    {settings.audience_targeting?.enabled && (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor="default_age_min">Minimum age</Label>
                            <Input
                              id="default_age_min"
                              type="number"
                              value={settings.audience_targeting?.default_age_min || 18}
                              onChange={(e) => handleTargetingChange('default_age_min', parseInt(e.target.value))}
                              min="13"
                              max="65"
                            />
                          </div>
                          <div>
                            <Label htmlFor="default_age_max">Maximum age</Label>
                            <Input
                              id="default_age_max"
                              type="number"
                              value={settings.audience_targeting?.default_age_max || 65}
                              onChange={(e) => handleTargetingChange('default_age_max', parseInt(e.target.value))}
                              min="13"
                              max="65"
                            />
                          </div>
                        </div>
                      </>
                    )}
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
                    placeholder={`${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/auth/facebook/callback`}
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
                    placeholder="https://yourdomain.com/webhooks/facebook"
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