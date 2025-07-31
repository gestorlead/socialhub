'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileVideo, FileImage, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { findNetworkOption, getMaxFilesForOption, optionSupportsMediaType } from '@/lib/network-configs'

interface MediaUploaderProps {
  onFileSelect: (files: File[], previews: string[]) => void
  selectedOptions: string[]
  maxFiles?: number
}

const TIKTOK_LIMITS = {
  video: {
    maxSize: 500 * 1024 * 1024, // 500MB (server upload limit)
    formats: ['video/mp4', 'video/mov', 'video/avi'],
    maxDuration: 10 * 60, // 10 minutes in seconds
    minDuration: 3, // 3 seconds
    aspectRatio: {
      min: 9/16, // Portrait
      max: 16/9  // Landscape
    }
  },
  image: {
    maxSize: 20 * 1024 * 1024, // 20MB
    formats: ['image/jpeg', 'image/jpg', 'image/png']
  }
}

export function MediaUploader({ onFileSelect, selectedOptions, maxFiles = 10 }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [validation, setValidation] = useState<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>({ isValid: true, errors: [], warnings: [] })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determinar o máximo de arquivos baseado nas opções selecionadas
  const getMaxFilesAllowed = () => {
    if (selectedOptions.length === 0) return maxFiles
    
    const limits = selectedOptions.map(optionId => getMaxFilesForOption(optionId))
    return Math.min(...limits, maxFiles)
  }

  // Determinar o tipo de mídia baseado nos arquivos selecionados
  const getMediaType = (files: File[]): 'image' | 'video' | 'carousel' => {
    if (files.length === 0) return 'image'
    if (files.length > 1) return 'carousel'
    
    const file = files[0]
    return file.type.startsWith('video/') ? 'video' : 'image'
  }

  const validateFiles = (files: File[]): { isValid: boolean, errors: string[], warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (files.length === 0) {
      return { isValid: true, errors, warnings }
    }

    // Validar número máximo de arquivos
    const maxAllowed = getMaxFilesAllowed()
    if (files.length > maxAllowed) {
      errors.push(`Máximo de ${maxAllowed} arquivos permitido para as opções selecionadas`)
    }

    // Validar cada arquivo individualmente
    files.forEach((file, index) => {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      
      if (!isVideo && !isImage) {
        errors.push(`Arquivo ${index + 1}: Apenas vídeos e imagens são suportados`)
        return
      }

      // Validar compatibilidade com opções selecionadas
      const mediaType = isVideo ? 'video' : 'image'
      const incompatibleOptions = selectedOptions.filter(optionId => 
        !optionSupportsMediaType(optionId, mediaType)
      )

      if (incompatibleOptions.length > 0) {
        const optionNames = incompatibleOptions.map(optionId => {
          const result = findNetworkOption(optionId)
          return result?.option.name || optionId
        })
        warnings.push(`Arquivo ${index + 1}: Não compatível com ${optionNames.join(', ')}`)
      }

      // Validações específicas baseadas nas limitações das redes
      if (selectedOptions.includes('tiktok_video') && isVideo) {
        if (!TIKTOK_LIMITS.video.formats.includes(file.type)) {
          errors.push(`Arquivo ${index + 1}: Formato de vídeo não suportado para TikTok. Use: ${TIKTOK_LIMITS.video.formats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`)
        }
        if (file.size > TIKTOK_LIMITS.video.maxSize) {
          errors.push(`Arquivo ${index + 1}: Vídeo muito grande para TikTok. Máximo: ${TIKTOK_LIMITS.video.maxSize / (1024*1024*1024)}GB`)
        }
      }

      // Validações para carrossel
      if (files.length > 1) {
        const carouselIncompatible = selectedOptions.filter(optionId => 
          !optionSupportsMediaType(optionId, 'carousel')
        )
        if (carouselIncompatible.length > 0) {
          const optionNames = carouselIncompatible.map(optionId => {
            const result = findNetworkOption(optionId)
            return result?.option.name || optionId
          })
          warnings.push(`Carrossel não compatível com ${optionNames.join(', ')}`)
        }
      }
    })

    return { isValid: errors.length === 0, errors, warnings }
  }

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    // Combinar com arquivos existentes se não exceder o limite
    const maxAllowed = getMaxFilesAllowed()
    const combinedFiles = [...uploadedFiles, ...newFiles].slice(0, maxAllowed)
    
    const validation = validateFiles(combinedFiles)
    setValidation(validation)
    
    setUploadedFiles(combinedFiles)
    
    // Create previews for all files
    const newPreviews: string[] = []
    let loadedCount = 0
    
    combinedFiles.forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        newPreviews[index] = result
        loadedCount++
        
        if (loadedCount === combinedFiles.length) {
          setPreviews(newPreviews)
          onFileSelect(combinedFiles, newPreviews)
        }
      }
      reader.readAsDataURL(file)
    })
    
    // Se não houver arquivos, limpar previews
    if (combinedFiles.length === 0) {
      setPreviews([])
      onFileSelect([], [])
    }
  }, [uploadedFiles, onFileSelect, selectedOptions])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFilesSelect(files)
    }
  }, [handleFilesSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    
    setUploadedFiles(newFiles)
    setPreviews(newPreviews)
    onFileSelect(newFiles, newPreviews)
    
    const validation = validateFiles(newFiles)
    setValidation(validation)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAllFiles = () => {
    setUploadedFiles([])
    setPreviews([])
    setValidation({ isValid: true, errors: [], warnings: [] })
    onFileSelect([], [])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) {
      return <FileVideo className="w-8 h-8 text-blue-500" />
    }
    return <FileImage className="w-8 h-8 text-green-500" />
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Upload de Mídia</h3>
      
      {selectedOptions.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Selecione pelo menos um destino de publicação para ver os requisitos de mídia
            </p>
          </div>
        </div>
      )}

      {selectedOptions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Requisitos baseados nos destinos selecionados
            </p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Máximo: {getMaxFilesAllowed()} arquivos • Suporta vídeos e imagens
          </p>
        </div>
      )}

      {uploadedFiles.length === 0 ? (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">
              {isDragging ? 'Solte os arquivos aqui' : 'Escolha arquivos ou arraste aqui'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Suporta vídeos e imagens • Máximo {getMaxFilesAllowed()} arquivos
            </p>
            
            {selectedOptions.includes('tiktok_video') && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>TikTok:</strong> MP4, MOV, AVI • Máx: 500MB por vídeo • 3s-10min</p>
                <p className="text-green-600 dark:text-green-400">
                  ✓ Upload via servidor - suporte a arquivos grandes
                </p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) handleFilesSelect(files)
            }}
            className="hidden"
          />
        </>
      ) : (
        <div className="space-y-4">
          {/* Files List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">
                Arquivos Selecionados ({uploadedFiles.length}/{getMaxFilesAllowed()})
              </h4>
              <button
                onClick={removeAllFiles}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remover todos
              </button>
            </div>
            
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-start gap-4 p-3 border rounded-lg bg-muted/30">
                <div className="flex-shrink-0">
                  {getFileIcon(file)}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium truncate text-sm">{file.name}</h5>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Validation Status */}
          {validation.isValid && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">
                Todos os arquivos são válidos
              </span>
            </div>
          )}

          {/* Preview Grid */}
          {previews.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Preview</h4>
              <div className={`grid gap-2 ${previews.length === 1 ? 'max-w-sm mx-auto' : previews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {previews.map((preview, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden bg-muted">
                    {uploadedFiles[index]?.type.startsWith('video/') ? (
                      <video
                        src={preview}
                        controls
                        className="w-full h-32 object-cover"
                      >
                        Seu navegador não suporta vídeos.
                      </video>
                    ) : (
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    )}
                    <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {!validation.isValid && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  Problemas encontrados
                </h4>
              </div>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Avisos
                </h4>
              </div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Add More Files Button */}
          {uploadedFiles.length < getMaxFilesAllowed() && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-muted rounded-lg hover:bg-muted/50 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar mais arquivos ({uploadedFiles.length}/{getMaxFilesAllowed()})
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) handleFilesSelect(files)
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}