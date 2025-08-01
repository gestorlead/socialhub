'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileVideo, FileImage, AlertTriangle, CheckCircle2, Plus, GripVertical } from 'lucide-react'
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
  
  // Estados para reordenação
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)
  
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

  const handleDropFiles = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFilesSelect(files)
    }
  }, [handleFilesSelect])

  const handleDragOverFiles = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeaveFiles = useCallback((e: React.DragEvent) => {
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

  // Função para reordenar arrays
  const reorderArray = <T,>(array: T[], fromIndex: number, toIndex: number): T[] => {
    const newArray = [...array]
    const [removed] = newArray.splice(fromIndex, 1)
    newArray.splice(toIndex, 0, removed)
    return newArray
  }

  // Handlers para drag and drop de reordenação
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
    
    // Criar um elemento visual para o drag
    const dragElement = e.currentTarget.cloneNode(true) as HTMLElement
    dragElement.style.opacity = '0.5'
    dragElement.style.transform = 'rotate(5deg)'
    document.body.appendChild(dragElement)
    e.dataTransfer.setDragImage(dragElement, 0, 0)
    setTimeout(() => document.body.removeChild(dragElement), 0)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverIndex(index)
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDraggedOverIndex(index)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Só remove o highlight se não estiver sobre um filho
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggedOverIndex(null)
    }
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDraggedOverIndex(null)
      return
    }

    // Reordenar arquivos e previews
    const newFiles = reorderArray(uploadedFiles, draggedIndex, dropIndex)
    const newPreviews = reorderArray(previews, draggedIndex, dropIndex)
    
    setUploadedFiles(newFiles)
    setPreviews(newPreviews)
    onFileSelect(newFiles, newPreviews)
    
    // Revalidar após reordenação
    const validation = validateFiles(newFiles)
    setValidation(validation)
    
    setDraggedIndex(null)
    setDraggedOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDraggedOverIndex(null)
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
            onDrop={handleDropFiles}
            onDragOver={handleDragOverFiles}
            onDragLeave={handleDragLeaveFiles}
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
              if (files.length > 0) {
                handleFilesSelect(files)
                // Limpar o valor do input para permitir selecionar os mesmos arquivos novamente
                e.target.value = ''
              }
            }}
            className="hidden"
          />
        </>
      ) : (
        <div 
          className="space-y-4"
          onDrop={handleDropFiles}
          onDragOver={handleDragOverFiles}
          onDragLeave={handleDragLeaveFiles}
        >
          {/* Files List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">
                Arquivos Selecionados ({uploadedFiles.length}/{getMaxFilesAllowed()})
              </h4>
              <div className="flex items-center gap-2">
                {uploadedFiles.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ↕️ Arraste para reordenar
                  </span>
                )}
                <button
                  onClick={removeAllFiles}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remover todos
                </button>
              </div>
            </div>
            
            {uploadedFiles.map((file, index) => (
              <div key={`file-${index}`} className="relative">
                {/* Drop Indicator - Aparece quando algo está sendo arrastado sobre este item */}
                {draggedOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                  <div className="absolute -top-1 left-0 right-0 h-1 bg-primary/50 rounded-full z-10" />
                )}
                
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-start gap-4 p-3 border rounded-lg transition-all cursor-move relative
                    ${draggedIndex === index 
                      ? 'bg-primary/10 border-primary/30 opacity-50 scale-105 shadow-lg' 
                      : draggedOverIndex === index && draggedIndex !== null && draggedIndex !== index
                        ? 'bg-primary/5 border-primary/20 border-dashed transform translate-y-1'
                        : 'bg-muted/30 hover:bg-muted/50 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Grip Handle */}
                  <div className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  
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
                    className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  {/* Dragging overlay */}
                  {draggedIndex === index && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg pointer-events-none" />
                  )}
                </div>
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
              <h4 className="font-medium text-sm mb-2">Preview (ordem de publicação)</h4>
              <div className={`grid gap-2 ${previews.length === 1 ? 'max-w-sm mx-auto' : previews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {previews.map((preview, index) => (
                  <div 
                    key={index} 
                    className={`
                      relative rounded-lg overflow-hidden bg-muted transition-all
                      ${draggedIndex === index ? 'ring-2 ring-primary/30' : ''}
                    `}
                  >
                    {uploadedFiles[index]?.type.startsWith('video/') ? (
                      <video
                        src={preview}
                        controls
                        className="w-full h-32 object-cover"
                        onContextMenu={(e) => e.preventDefault()} // Previne menu de contexto no video
                      >
                        Seu navegador não suporta vídeos.
                      </video>
                    ) : (
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover"
                        draggable={false} // Previne arrastar a imagem
                      />
                    )}
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                      {index + 1}
                    </div>
                    {draggedIndex === index && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                        <div className="bg-primary/80 text-white text-xs px-2 py-1 rounded font-medium">
                          Arrastando...
                        </div>
                      </div>
                    )}
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

          {/* Add More Files Button/Drop Zone */}
          {uploadedFiles.length < getMaxFilesAllowed() && (
            <div
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-all cursor-pointer text-sm
                ${isDragging 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="w-4 h-4" />
              {isDragging 
                ? 'Solte os arquivos aqui para adicionar' 
                : `Adicionar mais arquivos (${uploadedFiles.length}/${getMaxFilesAllowed()})`
              }
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                handleFilesSelect(files)
                // Limpar o valor do input para permitir selecionar os mesmos arquivos novamente
                e.target.value = ''
              }
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}