'use client'

import { useState } from 'react'
import { Send, Upload, CheckCircle, AlertTriangle, Clock, Stethoscope } from 'lucide-react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { TikTokUploadInfo } from './TikTokUploadInfo'
import { TikTokSandboxGuide } from './TikTokSandboxGuide'

interface PublishState {
  selectedNetworks: string[]
  mediaFile: File | null
  mediaPreview: string | null
  captions: {
    universal: string
    specific: {
      tiktok: string
    }
  }
  settings: {
    tiktok?: {
      privacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
      allowComments: boolean
      allowDuet: boolean
      allowStitch: boolean
      coverTimestamp: number
    }
  }
  isPublishing: boolean
}

interface PublishButtonProps {
  publishState: PublishState
  onPublish: () => void
  getEffectiveCaption: (network: string) => string
}

interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
  network?: string
}

export function PublishButton({ publishState, onPublish, getEffectiveCaption }: PublishButtonProps) {
  const { user } = useAuth()
  const [publishStatus, setPublishStatus] = useState<{
    [key: string]: 'pending' | 'uploading' | 'success' | 'error'
  }>({})
  const [publishErrors, setPublishErrors] = useState<{
    [key: string]: string
  }>({})
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [showTikTokInfo, setShowTikTokInfo] = useState(false)
  const [showSandboxGuide, setShowSandboxGuide] = useState(false)
  
  const runDiagnostics = async () => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/social/tiktok/diagnose?user_id=${user.id}`)
      const data = await response.json()
      setDiagnostics(data)
      setShowDiagnostics(true)
    } catch (error) {
      setDiagnostics({ error: 'Failed to run diagnostics' })
      setShowDiagnostics(true)
    }
  }
  
  const validatePublish = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    
    // Check if networks are selected
    if (publishState.selectedNetworks.length === 0) {
      issues.push({
        type: 'error',
        message: 'Selecione pelo menos uma rede social'
      })
    }
    
    // Check if media is uploaded
    if (!publishState.mediaFile) {
      issues.push({
        type: 'error',
        message: 'Adicione uma mídia para publicar'
      })
    }
    
    // Check captions for each network
    publishState.selectedNetworks.forEach(network => {
      const caption = getEffectiveCaption(network)
      
      if (!caption.trim()) {
        issues.push({
          type: 'warning',
          message: 'Legenda vazia pode afetar o alcance',
          network
        })
      }
      
      // TikTok specific validations
      if (network === 'tiktok') {
        if (caption.length > 2200) {
          issues.push({
            type: 'error',
            message: 'Legenda muito longa para TikTok (máx: 2200 caracteres)',
            network: 'tiktok'
          })
        }
      }
    })
    
    return issues
  }
  
  const validation = validatePublish()
  const errors = validation.filter(v => v.type === 'error')
  const warnings = validation.filter(v => v.type === 'warning')
  const canPublish = errors.length === 0 && !publishState.isPublishing
  
  const handlePublish = async () => {
    if (!canPublish || !user) return
    
    // Reset publish status and errors
    const initialStatus: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {}
    publishState.selectedNetworks.forEach(network => {
      initialStatus[network] = 'pending'
    })
    setPublishStatus(initialStatus)
    setPublishErrors({})
    
    // Call the parent's publish handler
    onPublish()
    
    // Process each network
    for (const network of publishState.selectedNetworks) {
      setPublishStatus(prev => ({ ...prev, [network]: 'uploading' }))
      
      try {
        if (network === 'tiktok') {
          await publishToTikTok(network)
        } else {
          // For other networks, mark as error for now
          setPublishStatus(prev => ({ ...prev, [network]: 'error' }))
          setPublishErrors(prev => ({ 
            ...prev, 
            [network]: 'Network not implemented yet' 
          }))
        }
      } catch (error) {
        setPublishStatus(prev => ({ ...prev, [network]: 'error' }))
        setPublishErrors(prev => ({ 
          ...prev, 
          [network]: error instanceof Error ? error.message : 'Unknown error' 
        }))
      }
    }
  }

  const publishToTikTok = async (network: string) => {
    if (!user || !publishState.mediaFile) return

    try {
      // Step 1: Upload file to our server
      setPublishStatus(prev => ({ ...prev, [network]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [network]: 'Enviando arquivo para servidor...' }))
      
      const formData = new FormData()
      formData.append('file', publishState.mediaFile)
      formData.append('userId', user.id)
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        throw new Error(uploadError.error || 'Failed to upload file')
      }
      
      const uploadResult = await uploadResponse.json()
      
      // Step 2: Submit to TikTok using PULL_FROM_URL
      setUploadProgress(prev => ({ ...prev, [network]: 'Enviando para o TikTok...' }))
      
      const publishPayload = {
        userId: user.id,
        mediaUrl: uploadResult.data.url,
        mediaType: publishState.mediaFile.type,
        caption: getEffectiveCaption(network),
        settings: publishState.settings.tiktok || {
          privacy: 'PUBLIC_TO_EVERYONE',
          allowComments: true,
          allowDuet: true,
          allowStitch: true
        }
      }
      
      const publishResponse = await fetch('/api/social/tiktok/publish-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(publishPayload)
      })
      
      const publishResult = await publishResponse.json()
      
      if (!publishResponse.ok || publishResult.error) {
        throw new Error(publishResult.error || `HTTP ${publishResponse.status}`)
      }
      
      // Step 3: Start checking status
      if (publishResult.data?.publish_id) {
        setUploadProgress(prev => ({ ...prev, [network]: 'Processando no TikTok...' }))
        const publishId = publishResult.data.publish_id
        
        // Check status every 3 seconds, up to 10 times (30 seconds total)
        let attempts = 0
        const maxAttempts = 10
        
        const checkStatus = async () => {
          const statusResponse = await fetch('/api/social/tiktok/status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              publishId: publishId
            })
          })
          
          const statusResult = await statusResponse.json()
          
          if (statusResult.data?.status === 'PUBLISH_COMPLETE') {
            setPublishStatus(prev => ({ ...prev, [network]: 'success' }))
            return true
          } else if (statusResult.data?.status === 'FAILED') {
            throw new Error(`TikTok publish failed: ${statusResult.data.fail_reason || 'Unknown reason'}`)
          }
          
          return false
        }
        
        // Initial check
        const published = await checkStatus()
        
        if (!published) {
          // Continue checking in background
          const interval = setInterval(async () => {
            attempts++
            try {
              const done = await checkStatus()
              if (done || attempts >= maxAttempts) {
                clearInterval(interval)
                if (!done && attempts >= maxAttempts) {
                }
              }
            } catch (error) {
              clearInterval(interval)
            }
          }, 3000)
        }
      }
      
      setPublishStatus(prev => ({ ...prev, [network]: 'success' }))
      
    } catch (error) {
      throw error
    }
  }

  
  const getNetworkName = (network: string) => {
    switch (network) {
      case 'tiktok': return 'TikTok'
      case 'instagram': return 'Instagram'
      case 'youtube': return 'YouTube'
      default: return network
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'uploading':
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }
  
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: string
  }>({})
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Aguardando...'
      case 'uploading':
        return 'Publicando...'
      case 'success':
        return 'Publicado!'
      case 'error':
        return 'Erro na publicação'
      default:
        return ''
    }
  }
  
  const isPublishing = Object.values(publishStatus).some(status => 
    status === 'pending' || status === 'uploading'
  )
  
  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Publicar Conteúdo</h3>
      
      {/* Validation Issues */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-4 space-y-2">
          {errors.map((error, index) => (
            <div key={`error-${index}`} className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-red-800 dark:text-red-200">{error.message}</span>
                {error.network && (
                  <span className="text-red-600 dark:text-red-400 ml-1">
                    ({getNetworkName(error.network)})
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {warnings.map((warning, index) => (
            <div key={`warning-${index}`} className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-yellow-800 dark:text-yellow-200">{warning.message}</span>
                {warning.network && (
                  <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                    ({getNetworkName(warning.network)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Publishing Status */}
      {Object.keys(publishStatus).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Status da Publicação:</h4>
          <div className="space-y-2">
            {publishState.selectedNetworks.map(network => {
              const status = publishStatus[network]
              const error = publishErrors[network]
              return (
                <div key={network} className="border rounded">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-sm font-medium">{getNetworkName(network)}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <div className="text-right">
                        <div className="text-sm">{getStatusText(status)}</div>
                        {uploadProgress[network] && status === 'uploading' && (
                          <div className="text-xs text-muted-foreground">
                            {uploadProgress[network]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {error && status === 'error' && (
                    <div className="px-2 pb-2">
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
                        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                      </div>
                    </div>
                  )}
                  {status === 'success' && (
                    <div className="px-2 pb-2">
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          ✓ Processo concluído com sucesso
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Verifique o TikTok para confirmar a publicação
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      
      {/* Publish Summary */}
      {canPublish && publishState.selectedNetworks.length > 0 && (
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Resumo da Publicação:</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>• Redes: {publishState.selectedNetworks.map(getNetworkName).join(', ')}</div>
            <div>• Mídia: {publishState.mediaFile?.name}</div>
            <div>• Tipo: {publishState.mediaFile?.type.startsWith('video/') ? 'Vídeo' : 'Imagem'}</div>
            {publishState.selectedNetworks.map(network => {
              const caption = getEffectiveCaption(network)
              return (
                <div key={network}>
                  • Legenda {getNetworkName(network)}: {
                    caption.length > 50 
                      ? `${caption.substring(0, 50)}... (${caption.length} chars)`
                      : caption || 'Sem legenda'
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Publish Button */}
      <button
        onClick={handlePublish}
        disabled={!canPublish || isPublishing}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
          canPublish && !isPublishing
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {isPublishing ? (
          <>
            <Upload className="w-4 h-4 animate-pulse" />
            Publicando...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Publicar em {publishState.selectedNetworks.length} 
            {publishState.selectedNetworks.length === 1 ? ' rede' : ' redes'}
          </>
        )}
      </button>
      
      {!canPublish && !isPublishing && errors.length === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Complete as informações necessárias para publicar
        </p>
      )}
      
      {errors.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">
          Corrija os erros acima para continuar
        </p>
      )}
      
      {/* Diagnostics Button */}
      {publishState.selectedNetworks.includes('tiktok') && (
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={runDiagnostics}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Stethoscope className="w-4 h-4" />
            Diagnosticar Conexão TikTok
          </button>
        </div>
      )}
      
      {/* Diagnostics Results */}
      {showDiagnostics && diagnostics && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Diagnóstico TikTok</h4>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>
          
          {diagnostics.error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{diagnostics.error}</p>
          ) : diagnostics.diagnosis ? (
            <div className="space-y-2 text-xs">
              <div>
                <strong>Token:</strong> {diagnostics.diagnosis.token.status}
                {diagnostics.diagnosis.token.error && (
                  <span className="text-red-500"> - {diagnostics.diagnosis.token.error}</span>
                )}
              </div>
              <div>
                <strong>Permissões:</strong> 
                {diagnostics.diagnosis.permissions.hasVideoPublish ? (
                  <span className="text-green-500"> ✓ video.publish</span>
                ) : (
                  <span className="text-red-500"> ✗ video.publish ausente</span>
                )}
              </div>
              <div>
                <strong>API TikTok:</strong> 
                {diagnostics.diagnosis.api.testPassed ? (
                  <span className="text-green-500"> ✓ Conectado</span>
                ) : (
                  <span className="text-red-500"> ✗ Falha na conexão</span>
                )}
              </div>
              {diagnostics.diagnosis.summary.issues.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                  <strong>Problemas encontrados:</strong>
                  <ul className="mt-1">
                    {diagnostics.diagnosis.summary.issues.map((issue: string, i: number) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem dados de diagnóstico</p>
          )}
        </div>
      )}
      
      {/* TikTok Upload Info */}
      {showTikTokInfo && (
        <div className="mt-4">
          <TikTokUploadInfo onClose={() => setShowTikTokInfo(false)} />
        </div>
      )}
      
      {/* TikTok Sandbox Guide */}
      {showSandboxGuide && (
        <TikTokSandboxGuide onClose={() => setShowSandboxGuide(false)} />
      )}
    </div>
  )
}