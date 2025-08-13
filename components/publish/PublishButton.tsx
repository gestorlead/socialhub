'use client'

import { useState, useEffect } from 'react'
import { Send, Upload, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { TikTokUploadInfo } from './TikTokUploadInfo'
import { TikTokSandboxGuide } from './TikTokSandboxGuide'
import { findNetworkOption } from '@/lib/network-configs'
import { usePublicationStatus } from '@/hooks/usePublicationStatus'
import { PRACTICAL_MAX_FILE_SIZE } from '@/lib/platform-limits'

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
  const [currentJobIds, setCurrentJobIds] = useState<string[]>([])
  const [publishErrors, setPublishErrors] = useState<{
    [key: string]: string
  }>({})
  const [showTikTokInfo, setShowTikTokInfo] = useState(false)
  const [showSandboxGuide, setShowSandboxGuide] = useState(false)
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  
  // Use the publication status hook for real-time job tracking
  const { jobs, statusByPlatform, isLoading: jobsLoading } = usePublicationStatus({
    jobIds: currentJobIds,
    autoFetch: true
  })
  
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
        // Page ID is required for Facebook posts
        if (!settings.page_id) {
          issues.push({
            type: 'error',
            message: 'Página do Facebook deve ser selecionada',
            optionId
          })
        }
        
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
  
  // Debug: Log validation errors and settings
  if (errors.length > 0) {
    console.log('[PublishButton] Validation errors preventing publish:', errors)
    console.log('[PublishButton] Current settings:', publishState.settings)
    console.log('[PublishButton] Selected options:', publishState.selectedOptions)
  }
  
  const handlePublish = async () => {
    // Mostrar erros de validação quando tentar publicar
    setShowValidationErrors(true)
    
    if (!canPublish || !user) return
    
    // Reset errors
    setPublishErrors({})
    
    // Call the parent's publish handler
    onPublish()

    try {
      // Step 1: Basic file size validation (general upload limit)
      // Platform-specific validation will happen during enqueuing
      const oversizedFiles = publishState.mediaFiles.filter(file => file.size > PRACTICAL_MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        const maxSizeGB = Math.round(PRACTICAL_MAX_FILE_SIZE / (1024*1024*1024))
        throw new Error(`Arquivo muito grande: ${oversizedFiles[0].name} (${(oversizedFiles[0].size / 1024 / 1024).toFixed(2)}MB). Máximo: ${maxSizeGB}GB. Limites específicos por plataforma serão validados durante a publicação.`)
      }
      
      // Step 2: Upload files to our server first
      setUploadProgress(prev => ({ ...prev, 'upload': 'Enviando arquivos para servidor...' }))
      
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
      const mediaFiles = Array.isArray(uploadResult.data) 
        ? uploadResult.data.map((item: any, index: number) => ({
            name: publishState.mediaFiles[index]?.name || `file${index}`,
            size: publishState.mediaFiles[index]?.size || 0,
            type: publishState.mediaFiles[index]?.type || 'unknown',
            url: item.url
          }))
        : [{
            name: publishState.mediaFiles[0]?.name || 'file',
            size: publishState.mediaFiles[0]?.size || 0,
            type: publishState.mediaFiles[0]?.type || 'unknown',
            url: uploadResult.data.url
          }]

      // Step 3: Enqueue jobs for background processing
      setUploadProgress(prev => ({ ...prev, 'upload': 'Criando jobs de publicação...' }))
      
      const enqueueResponse = await fetch('/api/publications/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          selectedOptions: publishState.selectedOptions,
          mediaFiles: mediaFiles,
          captions: publishState.captions,
          settings: publishState.settings
        })
      })
      
      let enqueueResult
      try {
        enqueueResult = await enqueueResponse.json()
      } catch (jsonError) {
        // Handle non-JSON responses (like 413 error pages)
        if (enqueueResponse.status === 413) {
          throw new Error('Payload muito grande. Verifique os limites por plataforma e tente novamente.')
        }
        throw new Error(`Erro do servidor (${enqueueResponse.status}). Tente novamente.`)
      }
      
      if (!enqueueResponse.ok || !enqueueResult.success) {
        throw new Error(enqueueResult.error || 'Failed to enqueue publication jobs')
      }

      // Step 4: Track the created jobs
      const { jobs, errors } = enqueueResult.data
      
      // Set job IDs for tracking
      setCurrentJobIds(jobs.map((job: any) => job.job_id))

      // Handle any jobs that failed to enqueue
      if (errors && errors.length > 0) {
        const errorMap: { [key: string]: string } = {}
        errors.forEach((error: any) => {
          errorMap[error.platform] = error.error
        })
        setPublishErrors(errorMap)
      }

      console.log('[PublishButton] Jobs enqueued successfully:', {
        totalJobs: jobs.length,
        totalErrors: errors?.length || 0,
        jobIds: jobs.map((j: any) => j.job_id)
      })

      // Clear upload progress after successful enqueue
      setUploadProgress({})

    } catch (error) {
      console.error('[PublishButton] Enqueue failed:', error)
      
      // Set all selected options to error state
      const errorMap: { [key: string]: string } = {}
      publishState.selectedOptions.forEach(optionId => {
        errorMap[optionId] = error instanceof Error ? error.message : 'Failed to enqueue job'
      })
      setPublishErrors(errorMap)
      setUploadProgress({})
    }
  }

  // Note: Individual platform publish functions removed
  // Publishing is now handled by the queue system via /api/publications/enqueue
  // and processed in background by /api/internal/process-publication

  const getOptionName = (optionId: string) => {
    const result = findNetworkOption(optionId)
    return result?.option.name || optionId
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'processing':
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }
  
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: string
  }>({})
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Na fila...'
      case 'processing':
        return 'Publicando...'
      case 'completed':
        return 'Publicado!'
      case 'failed':
        return 'Erro na publicação'
      default:
        return 'Aguardando...'
    }
  }
  
  // Combine job statuses with local errors for comprehensive status tracking
  const getEffectiveStatus = (optionId: string) => {
    // Check if there's an error for this platform
    if (publishErrors[optionId]) {
      return 'failed'
    }
    
    // Check real-time job status
    const jobStatus = statusByPlatform[optionId]
    if (jobStatus) {
      return jobStatus
    }
    
    // Default to pending if job was enqueued
    if (currentJobIds.length > 0) {
      return 'pending'
    }
    
    return null
  }
  
  const isPublishing = publishState.selectedOptions.some(optionId => {
    const status = getEffectiveStatus(optionId)
    return status === 'pending' || status === 'processing'
  }) || Object.keys(uploadProgress).length > 0
  
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
      {(currentJobIds.length > 0 || Object.keys(publishErrors).length > 0) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Status da Publicação:</h4>
          <div className="space-y-2">
            {publishState.selectedOptions.map(optionId => {
              const status = getEffectiveStatus(optionId)
              const error = publishErrors[optionId]
              const job = Object.values(jobs).find(j => j.platform === optionId)
              
              return (
                <div key={optionId} className="border rounded">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-sm font-medium">{getOptionName(optionId)}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status || 'pending')}
                      <div className="text-right">
                        <div className="text-sm">{getStatusText(status || 'pending')}</div>
                        {uploadProgress[optionId] && (
                          <div className="text-xs text-muted-foreground">
                            {uploadProgress[optionId]}
                          </div>
                        )}
                        {job && status === 'processing' && job.started_at && (
                          <div className="text-xs text-muted-foreground">
                            Iniciado {new Date(job.started_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {(error || (job?.error_message && status === 'failed')) && (
                    <div className="px-2 pb-2">
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {error || job?.error_message}
                        </p>
                        {job && job.retry_count > 0 && job.retry_count < job.max_retries && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Tentativa {job.retry_count} de {job.max_retries}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {status === 'completed' && (
                    <div className="px-2 pb-2">
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          ✓ Processo concluído com sucesso
                        </p>
                        {job?.completed_at && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Finalizado em {new Date(job.completed_at).toLocaleTimeString()}
                          </p>
                        )}
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