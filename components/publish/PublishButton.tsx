'use client'

import { useState, useEffect } from 'react'
import { Send, Upload, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { TikTokUploadInfo } from './TikTokUploadInfo'
import { TikTokSandboxGuide } from './TikTokSandboxGuide'
import { findNetworkOption } from '@/lib/network-configs'

interface PublishState {
  selectedOptions: string[]
  mediaFiles: File[]
  mediaPreviews: string[]
  captions: {
    universal: string
    specific: Record<string, string>
  }
  settings: Record<string, any>
  isPublishing: boolean
}

interface PublishButtonProps {
  publishState: PublishState
  onPublish: () => void
  getEffectiveCaption: (optionId: string) => string
}

interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
  optionId?: string
}

export function PublishButton({ publishState, onPublish, getEffectiveCaption }: PublishButtonProps) {
  const { user } = useAuth()
  const [publishStatus, setPublishStatus] = useState<{
    [key: string]: 'pending' | 'uploading' | 'success' | 'error'
  }>({})
  const [publishErrors, setPublishErrors] = useState<{
    [key: string]: string
  }>({})
  const [showTikTokInfo, setShowTikTokInfo] = useState(false)
  const [showSandboxGuide, setShowSandboxGuide] = useState(false)
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  
  // Reset validation errors when user makes changes
  useEffect(() => {
    if (showValidationErrors) {
      setShowValidationErrors(false)
    }
  }, [
    publishState.mediaFiles,
    publishState.selectedOptions,
    publishState.captions
  ])
  
  
  const validatePublish = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    
    // Check if options are selected
    if (publishState.selectedOptions.length === 0) {
      issues.push({
        type: 'error',
        message: 'Selecione pelo menos um destino de publicação'
      })
    }
    
    // Check if media is uploaded
    if (publishState.mediaFiles.length === 0) {
      issues.push({
        type: 'error',
        message: 'Adicione pelo menos uma mídia para publicar'
      })
    }
    
    // Check captions and settings for each option
    publishState.selectedOptions.forEach(optionId => {
      const caption = getEffectiveCaption(optionId)
      const result = findNetworkOption(optionId)
      const settings = publishState.settings[optionId] || {}
      
      if (!caption.trim()) {
        issues.push({
          type: 'warning',
          message: 'Legenda vazia pode afetar o alcance',
          optionId
        })
      }
      
      // YouTube specific validations - Título obrigatório
      if (optionId === 'youtube_video' || optionId === 'youtube_shorts') {
        if (!settings.title || !settings.title.trim()) {
          issues.push({
            type: 'error',
            message: 'Título é obrigatório para YouTube',
            optionId
          })
        } else if (settings.title.length > 100) {
          issues.push({
            type: 'error',
            message: 'Título muito longo para YouTube (máx: 100 caracteres)',
            optionId
          })
        }
        
        // A legenda do YouTube será usada como descrição
        // YouTube permite até 5000 caracteres na descrição/legenda
        if (caption.length > 5000) {
          issues.push({
            type: 'error',
            message: 'Legenda muito longa para YouTube (máx: 5000 caracteres)',
            optionId
          })
        }
        
        if (settings.tags && settings.tags.length > 500) {
          issues.push({
            type: 'error',
            message: 'Tags muito longas para YouTube (máx: 500 caracteres)',
            optionId
          })
        }
      }
      
      // TikTok specific validations
      if (optionId === 'tiktok_video') {
        if (caption.length > 2200) {
          issues.push({
            type: 'error',
            message: 'Legenda muito longa para TikTok (máx: 2200 caracteres)',
            optionId: 'tiktok_video'
          })
        }
      }
      
      // Instagram specific validations
      if (optionId.startsWith('instagram_')) {
        if (caption.length > 2200) {
          issues.push({
            type: 'error',
            message: 'Legenda muito longa para Instagram (máx: 2200 caracteres)',
            optionId
          })
        }
        
        // Instagram Story - limited to 1 media item
        if (optionId === 'instagram_story') {
          if (publishState.mediaFiles.length > 1) {
            issues.push({
              type: 'error',
              message: 'Instagram Stories permite apenas 1 mídia por publicação',
              optionId
            })
          }
        }
        
        // Instagram Reels - requires video only
        if (optionId === 'instagram_reels') {
          if (publishState.mediaFiles.length !== 1) {
            issues.push({
              type: 'error',
              message: 'Instagram Reels requer exatamente 1 vídeo',
              optionId
            })
          } else if (!publishState.mediaFiles[0].type.startsWith('video/')) {
            issues.push({
              type: 'error',
              message: 'Instagram Reels aceita apenas vídeos',
              optionId
            })
          }
        }
        
        // Instagram Feed - supports up to 10 items for carousel
        if (optionId === 'instagram_feed') {
          if (publishState.mediaFiles.length > 10) {
            issues.push({
              type: 'error',
              message: 'Instagram Feed permite máximo de 10 mídias por carrossel',
              optionId
            })
          }
        }
        
        // All Instagram types - JPEG only for images
        publishState.mediaFiles.forEach((file, index) => {
          if (file.type.startsWith('image/') && !file.type.includes('jpeg')) {
            issues.push({
              type: 'warning',
              message: `Instagram aceita apenas imagens JPEG (arquivo ${index + 1} é ${file.type})`,
              optionId
            })
          }
        })
      }
      
      // Threads specific validations
      if (optionId === 'threads_post') {
        if (caption.length > 500) {
          issues.push({
            type: 'error',
            message: 'Texto muito longo para Threads (máx: 500 caracteres)',
            optionId
          })
        }
      }
      
      // X (Twitter) specific validations
      if (optionId === 'x_post') {
        if (caption.length > 280) {
          issues.push({
            type: 'error',
            message: 'Texto muito longo para X (máx: 280 caracteres)',
            optionId
          })
        }
      }
      
      // Facebook specific validations
      if (optionId.startsWith('facebook_')) {
        if (settings.publishTime === 'scheduled' && !settings.scheduledTime) {
          issues.push({
            type: 'error',
            message: 'Data e hora de agendamento obrigatórias',
            optionId
          })
        }
        
        if (settings.scheduledTime) {
          const scheduledDate = new Date(settings.scheduledTime)
          const now = new Date()
          const minTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes
          const maxTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
          
          if (scheduledDate < minTime) {
            issues.push({
              type: 'error',
              message: 'Agendamento deve ser pelo menos 10 minutos no futuro',
              optionId
            })
          }
          
          if (scheduledDate > maxTime) {
            issues.push({
              type: 'error',
              message: 'Agendamento não pode ser mais de 30 dias no futuro',
              optionId
            })
          }
        }
      }
    })
    
    return issues
  }
  
  // Calcula validação mas só mostra erros se showValidationErrors for true
  const validation = validatePublish()
  const errors = validation.filter(v => v.type === 'error')
  const warnings = validation.filter(v => v.type === 'warning')
  const canPublish = errors.length === 0 && !publishState.isPublishing
  
  const handlePublish = async () => {
    // Mostrar erros de validação quando tentar publicar
    setShowValidationErrors(true)
    
    if (!canPublish || !user) return
    
    // Reset publish status and errors
    const initialStatus: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {}
    publishState.selectedOptions.forEach(optionId => {
      initialStatus[optionId] = 'pending'
    })
    setPublishStatus(initialStatus)
    setPublishErrors({})
    
    // Call the parent's publish handler
    onPublish()
    
    // Process each option
    for (const optionId of publishState.selectedOptions) {
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      
      try {
        if (optionId === 'tiktok_video') {
          await publishToTikTok(optionId)
        } else if (optionId === 'facebook_post' || optionId === 'facebook_story' || optionId === 'facebook_reels') {
          await publishToFacebook(optionId)
        } else if (optionId.startsWith('instagram_')) {
          await publishToInstagram(optionId)
        } else if (optionId.startsWith('youtube_')) {
          await publishToYouTube(optionId)
        } else if (optionId === 'threads_post') {
          await publishToThreads(optionId)
        } else if (optionId === 'x_post') {
          await publishToX(optionId)
        } else if (optionId.startsWith('linkedin_')) {
          await publishToLinkedIn(optionId)
        } else {
          // Opção não reconhecida
          const result = findNetworkOption(optionId)
          const optionName = result?.option.name || optionId
          
          setPublishStatus(prev => ({ ...prev, [optionId]: 'error' }))
          setPublishErrors(prev => ({ 
            ...prev, 
            [optionId]: `${optionName} não reconhecido` 
          }))
        }
      } catch (error) {
        setPublishStatus(prev => ({ ...prev, [optionId]: 'error' }))
        setPublishErrors(prev => ({ 
          ...prev, 
          [optionId]: error instanceof Error ? error.message : 'Unknown error' 
        }))
      }
    }
  }

  const publishToTikTok = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      // Step 1: Upload file to our server
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Enviando arquivo para servidor...' }))
      
      const formData = new FormData()
      formData.append('file', publishState.mediaFiles[0]) // Use first file for TikTok
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
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Enviando para o TikTok...' }))
      
      const publishPayload = {
        userId: user.id,
        mediaUrl: uploadResult.data.url,
        mediaType: publishState.mediaFiles[0].type,
        caption: getEffectiveCaption(optionId),
        settings: publishState.settings[optionId] || {
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
        setUploadProgress(prev => ({ ...prev, [optionId]: 'Processando no TikTok...' }))
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
            setPublishStatus(prev => ({ ...prev, [optionId]: 'success' }))
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
      
      setPublishStatus(prev => ({ ...prev, [optionId]: 'success' }))
      
    } catch (error) {
      throw error
    }
  }

  
  const publishToFacebook = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      // Step 1: Upload file to our server
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Enviando arquivo para servidor...' }))
      
      const formData = new FormData()
      publishState.mediaFiles.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })
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
      const mediaUrls = Array.isArray(uploadResult.data) 
        ? uploadResult.data.map((item: any) => item.url)
        : [uploadResult.data.url]
      
      // Step 2: Submit to Facebook
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Enviando para o Facebook...' }))
      
      const firstFile = publishState.mediaFiles[0]
      const mediaType = firstFile.type.startsWith('video/') ? 'video' : 'photo'
      
      const publishPayload = {
        page_id: publishState.settings[optionId]?.page_id, // Get from settings
        message: getEffectiveCaption(optionId),
        media_urls: mediaUrls,
        media_type: mediaType,
        privacy: publishState.settings[optionId]?.privacy || { value: 'EVERYONE' },
        scheduled_publish_time: publishState.settings[optionId]?.scheduled_publish_time
      }

      const authHeader = await user.getIdToken()
      
      const publishResponse = await fetch('/api/social/facebook/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authHeader}`
        },
        body: JSON.stringify(publishPayload)
      })
      
      const publishResult = await publishResponse.json()
      
      if (!publishResponse.ok || publishResult.error) {
        throw new Error(publishResult.error || publishResult.details || `HTTP ${publishResponse.status}`)
      }
      
      setPublishStatus(prev => ({ ...prev, [optionId]: 'success' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Publicado com sucesso!' }))
      
    } catch (error: any) {
      console.error('Facebook publish error:', error)
      setPublishStatus(prev => ({ ...prev, [optionId]: 'error' }))
      setPublishErrors(prev => ({ 
        ...prev, 
        [optionId]: error.message || 'Erro ao publicar no Facebook' 
      }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Erro na publicação' }))
    }
  }

  const publishToInstagram = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      // Step 1: Upload files to our server
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Enviando arquivos para servidor...' }))
      
      const formData = new FormData()
      publishState.mediaFiles.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })
      formData.append('userId', user.id)
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        throw new Error(uploadError.error || 'Failed to upload files')
      }
      
      const uploadResult = await uploadResponse.json()
      const mediaUrls = Array.isArray(uploadResult.data) 
        ? uploadResult.data.map((item: any) => item.url)
        : [uploadResult.data.url]
      
      // Step 2: Publish to Instagram
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Publicando no Instagram...' }))
      
      const publishPayload = {
        userId: user.id,
        optionId: optionId as 'instagram_feed' | 'instagram_story' | 'instagram_reels',
        mediaUrls: mediaUrls,
        caption: getEffectiveCaption(optionId),
        settings: publishState.settings[optionId] || {}
      }
      
      const publishResponse = await fetch('/api/social/instagram/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(publishPayload)
      })
      
      const publishResult = await publishResponse.json()
      
      if (!publishResponse.ok || publishResult.error) {
        throw new Error(publishResult.error || publishResult.details || `HTTP ${publishResponse.status}`)
      }
      
      setPublishStatus(prev => ({ ...prev, [optionId]: 'success' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Publicado com sucesso!' }))
      
    } catch (error: any) {
      console.error('Instagram publish error:', error)
      throw error
    }
  }

  const publishToYouTube = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Preparando para YouTube...' }))
      
      // TODO: Implementar API do YouTube
      throw new Error('YouTube ainda não implementado')
      
    } catch (error: any) {
      throw error
    }
  }

  const publishToThreads = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Preparando para Threads...' }))
      
      // TODO: Implementar API do Threads
      throw new Error('Threads ainda não implementado')
      
    } catch (error: any) {
      throw error
    }
  }

  const publishToX = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Preparando para X...' }))
      
      // TODO: Implementar API do X
      throw new Error('X ainda não implementado')
      
    } catch (error: any) {
      throw error
    }
  }

  const publishToLinkedIn = async (optionId: string) => {
    if (!user || publishState.mediaFiles.length === 0) return

    try {
      setPublishStatus(prev => ({ ...prev, [optionId]: 'uploading' }))
      setUploadProgress(prev => ({ ...prev, [optionId]: 'Preparando para LinkedIn...' }))
      
      // TODO: Implementar API do LinkedIn
      throw new Error('LinkedIn ainda não implementado')
      
    } catch (error: any) {
      throw error
    }
  }

  const getOptionName = (optionId: string) => {
    const result = findNetworkOption(optionId)
    return result?.option.name || optionId
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
      
      {/* Validation Issues - só mostra após tentativa de publicar */}
      {showValidationErrors && (errors.length > 0 || warnings.length > 0) && (
        <div className="mb-4 space-y-2">
          {errors.map((error, index) => (
            <div key={`error-${index}`} className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-red-800 dark:text-red-200">{error.message}</span>
                {error.optionId && (
                  <span className="text-red-600 dark:text-red-400 ml-1">
                    ({getOptionName(error.optionId)})
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
                {warning.optionId && (
                  <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                    ({getOptionName(warning.optionId)})
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
            {publishState.selectedOptions.map(optionId => {
              const status = publishStatus[optionId]
              const error = publishErrors[optionId]
              return (
                <div key={optionId} className="border rounded">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-sm font-medium">{getOptionName(optionId)}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <div className="text-right">
                        <div className="text-sm">{getStatusText(status)}</div>
                        {uploadProgress[optionId] && status === 'uploading' && (
                          <div className="text-xs text-muted-foreground">
                            {uploadProgress[optionId]}
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
                          Verifique a plataforma para confirmar a publicação
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
            Publicar em {publishState.selectedOptions.length} 
            {publishState.selectedOptions.length === 1 ? ' destino' : ' destinos'}
          </>
        )}
      </button>
      
      {!canPublish && !isPublishing && showValidationErrors && errors.length === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Complete as informações necessárias para publicar
        </p>
      )}
      
      {showValidationErrors && errors.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">
          Corrija os erros acima para continuar
        </p>
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