'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
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
  FileText
} from 'lucide-react'

interface TikTokSettings {
  id?: string
  app_id?: string
  client_key?: string
  client_secret?: string
  environment: 'sandbox' | 'production'
  is_audited: boolean
  webhook_url?: string
  callback_url?: string
  is_active: boolean
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
  oauth_endpoints: TestResult
  api_access: TestResult
}

export function TikTokIntegrationForm() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<TikTokSettings>({
    environment: 'sandbox',
    is_audited: false,
    is_active: true
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
    app_id: false,
    client_key: false,
    client_secret: false
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
    loadSettings()
  }, [])

  const getAuthToken = async () => {
    try {
      console.log('Getting auth token...')
      // Get token from Supabase client (using secure getUser method)
      const { data: { user } } = await import('@/lib/supabase').then(m => m.supabase.auth.getUser())
      const session = user ? { user } : null
      console.log('Session exists:', !!session)
      console.log('Access token exists:', !!session?.access_token)
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
      const response = await fetch('/api/admin/integrations/tiktok', {
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
      console.log('Starting save operation...')
      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')
      
      // Validate required fields
      if (!settings.app_id || !settings.client_key || !settings.client_secret) {
        setErrorMessage('App ID, Client Key e Client Secret são obrigatórios')
        setSaving(false)
        return
      }
      
      const token = await getAuthToken()
      console.log('Token obtained:', !!token)
      console.log('Settings to save:', {
        ...settings,
        client_secret: settings.client_secret ? '***' : undefined
      })
      
      const response = await fetch('/api/admin/integrations/tiktok', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Success response:', data)
        setSuccessMessage('Configurações salvas com sucesso!')
        setTimeout(() => setSuccessMessage(''), 5000)
        await loadSettings() // Reload to get updated data
      } else {
        const error = await response.json()
        console.error('Error response:', error)
        setErrorMessage(error.details ? `${error.error}: ${error.details}` : error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Save error:', error)
      setErrorMessage(`Erro ao salvar: ${error.message || error}`)
    } finally {
      console.log('Save operation completed')
      setSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      setTestResults(null)
      
      const token = await getAuthToken()
      const response = await fetch('/api/admin/integrations/tiktok/test', {
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

  const handleInputChange = (field: keyof TikTokSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Carregando configurações...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">{successMessage}</span>
        </div>
      )}
      
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{errorMessage}</span>
        </div>
      )}

      {/* Configuration Source */}
      {settings.config_data?.source && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          {settings.config_data.source === 'database' ? (
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Configuração atual: {settings.config_data.source === 'database' ? 'Banco de dados' : 'Arquivo .env (fallback)'}
          </span>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }} className="space-y-6">
        {/* App Credentials */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Credenciais do App TikTok</h3>
          
          {/* App ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              App ID
            </label>
            <input
              type="text"
              value={settings.app_id || ''}
              onChange={(e) => handleInputChange('app_id', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite o App ID do TikTok"
              required
            />
          </div>

          {/* Client Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Client Key
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_key ? 'text' : 'password'}
                value={settings.client_key || ''}
                onChange={(e) => handleInputChange('client_key', e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o Client Key do TikTok"
                required
              />
              <button
                type="button"
                onClick={() => toggleSecretVisibility('client_key')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecrets.client_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_secret ? 'text' : 'password'}
                value={settings.client_secret || ''}
                onChange={(e) => handleInputChange('client_secret', e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o Client Secret do TikTok"
                required
              />
              <button
                type="button"
                onClick={() => toggleSecretVisibility('client_secret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecrets.client_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Environment Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configurações de Ambiente</h3>
          
          {/* Environment Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ambiente
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="environment"
                  value="sandbox"
                  checked={settings.environment === 'sandbox'}
                  onChange={(e) => handleInputChange('environment', e.target.value)}
                  className="mr-2"
                />
                Sandbox (Desenvolvimento)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="environment"
                  value="production"
                  checked={settings.environment === 'production'}
                  onChange={(e) => handleInputChange('environment', e.target.value)}
                  className="mr-2"
                />
                Produção
              </label>
            </div>
          </div>

          {/* App Audited */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.is_audited}
                onChange={(e) => handleInputChange('is_audited', e.target.checked)}
                className="mr-2"
              />
              App auditado pelo TikTok
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Marque apenas se seu app foi aprovado pela auditoria do TikTok para uso em produção
            </p>
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.is_active}
                onChange={(e) => handleInputChange('is_active', e.target.checked)}
                className="mr-2"
              />
              Integração ativa
            </label>
          </div>
        </div>

        {/* URLs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">URLs de Callback</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Callback URL
            </label>
            <input
              type="url"
              value={settings.callback_url || ''}
              onChange={(e) => handleInputChange('callback_url', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/auth/tiktok/callback`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Webhook URL (opcional)
            </label>
            <input
              type="url"
              value={settings.webhook_url || ''}
              onChange={(e) => handleInputChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://yourdomain.com/webhooks/tiktok"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            {testing ? 'Testando...' : 'Testar Conectividade'}
          </button>
        </div>
      </form>

      {/* Test Results */}
      {testResults && (
        <div className="mt-6 p-4 border rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            {testResults.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            Resultado dos Testes
          </h3>
          
          {testResults.error ? (
            <p className="text-red-600">{testResults.error}</p>
          ) : (
            <div className="space-y-3">
              {testResults.tests && Object.entries(testResults.tests).map(([key, result]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  {result.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium capitalize">{key.replace('_', ' ')}</h4>
                    <p className="text-sm text-gray-600">{result.message}</p>
                    {result.details && (
                      <pre className="text-xs text-gray-500 mt-1 bg-white p-2 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              
              {testResults.summary && (
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <h4 className="font-medium text-blue-800">Resumo</h4>
                  <p className="text-sm text-blue-600">
                    {testResults.summary.passed_tests} de {testResults.summary.total_tests} testes passaram
                  </p>
                  <p className="text-xs text-blue-500">
                    Ambiente: {testResults.summary.environment} | 
                    Auditado: {testResults.summary.is_audited ? 'Sim' : 'Não'} |
                    Fonte: {testResults.summary.config_source}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}