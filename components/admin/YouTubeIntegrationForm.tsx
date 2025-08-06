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
  FileText,
  Copy,
  Check
} from 'lucide-react'

interface YouTubeSettings {
  id?: string
  app_id?: string
  client_key?: string
  client_secret?: string
  environment?: 'sandbox' | 'production'
  is_audited?: boolean
  webhook_url?: string
  callback_url?: string
  is_active: boolean
  config_data?: {
    source?: string
    project_id?: string
    auth_uri?: string
    token_uri?: string
    auth_provider_x509_cert_url?: string
    redirect_uris?: string[]
    last_updated_by?: string
    last_updated_at?: string
    [key: string]: unknown
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
  quota_check: TestResult
}

export function YouTubeIntegrationForm() {
  const { user, session } = useAuth()
  const [settings, setSettings] = useState<YouTubeSettings>({
    environment: 'production',
    is_audited: true,
    is_active: true,
    config_data: {
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      redirect_uris: []
    }
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
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

  // Callback URL padrão
  const defaultCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}/api/auth/youtube/callback`


  // Load current settings
  useEffect(() => {
    if (session) {
      loadSettings()
    }
  }, [session])

  const getAuthToken = async () => {
    try {
      if (!session?.access_token) {
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
      const response = await fetch('/api/admin/integrations/youtube', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings({
          ...data.data,
          config_data: {
            ...data.data.config_data,
            redirect_uris: data.data.config_data?.redirect_uris || [defaultCallbackUrl]
          }
        })
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
      if (!settings.client_key || !settings.client_secret || !settings.config_data?.project_id) {
        setErrorMessage('Client ID, Client Secret e Project ID são obrigatórios')
        setSaving(false)
        return
      }
      
      const token = await getAuthToken()
      const response = await fetch('/api/admin/integrations/youtube', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: settings.client_key,
          client_secret: settings.client_secret,
          project_id: settings.config_data?.project_id,
          auth_uri: settings.config_data?.auth_uri,
          token_uri: settings.config_data?.token_uri,
          auth_provider_x509_cert_url: settings.config_data?.auth_provider_x509_cert_url,
          callback_url: settings.callback_url || defaultCallbackUrl,
          redirect_uris: [settings.callback_url || defaultCallbackUrl],
          is_active: settings.is_active
        })
      })
      
      if (response.ok) {
        setSuccessMessage('Configurações salvas com sucesso!')
        setTimeout(() => setSuccessMessage(''), 5000)
        await loadSettings()
      } else {
        const error = await response.json()
        setErrorMessage(error.details ? `${error.error}: ${error.details}` : error.error || 'Failed to save settings')
      }
    } catch (error) {
      setErrorMessage(`Erro ao salvar: ${error.message || error}`)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      setTestResults(null)
      
      const token = await getAuthToken()
      const response = await fetch('/api/admin/integrations/youtube/test', {
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

  const copyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(settings.callback_url || defaultCallbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleInputChange = (field: keyof YouTubeSettings, value: any) => {
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
        {/* Google Cloud Project */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Projeto Google Cloud</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Project ID *
            </label>
            <input
              type="text"
              value={settings.config_data?.project_id || ''}
              onChange={(e) => handleInputChange('config_data', { ...settings.config_data, project_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="my-youtube-project"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              ID do projeto no Google Cloud Console onde a YouTube Data API está habilitada.
              <br />
              <strong>Diferente do Client ID!</strong> É o nome que você escolheu para o projeto.
            </p>
          </div>
        </div>

        {/* OAuth 2.0 Credentials */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Credenciais OAuth 2.0</h3>
          
          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Client ID *
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_key ? 'text' : 'password'}
                value={settings.client_key || ''}
                onChange={(e) => handleInputChange('client_key', e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="xxxxxxxxxx.apps.googleusercontent.com"
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
              Client Secret *
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_secret ? 'text' : 'password'}
                value={settings.client_secret || ''}
                onChange={(e) => handleInputChange('client_secret', e.target.value)}
                className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
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


        {/* Callback URL */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">URL de Callback</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Redirect URI
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.callback_url || defaultCallbackUrl}
                onChange={(e) => handleInputChange('callback_url', e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder={defaultCallbackUrl}
              />
              <button
                type="button"
                onClick={copyCallbackUrl}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                title="Copiar URL"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Configure esta URL no Google Cloud Console como URI de redirecionamento autorizada
            </p>
          </div>
        </div>

        {/* Active Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Status da Integração</h3>
          
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
            <p className="text-xs text-gray-500 mt-1">
              Desmarque para desativar temporariamente a integração
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Important Notice */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>Configure no Google Cloud Console:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Crie um projeto e habilite a YouTube Data API v3</li>
              <li>Configure o OAuth consent screen</li>
              <li>Crie credenciais OAuth 2.0 (Client ID e Client Secret)</li>
              <li>Adicione esta URL como redirect URI autorizada: <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">{settings.callback_url || defaultCallbackUrl}</code></li>
              <li>Configure os escopos necessários: <code>https://www.googleapis.com/auth/youtube.readonly</code></li>
            </ul>
          </div>
        </div>
      </div>

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
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/50 rounded">
                  <h4 className="font-medium text-red-800 dark:text-red-200">Resumo</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {testResults.summary.passed_tests} de {testResults.summary.total_tests} testes passaram
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-500">
                    Project ID: {testResults.summary.project_id || 'Não configurado'} | 
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