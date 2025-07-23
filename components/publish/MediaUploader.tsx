'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileVideo, FileImage, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface MediaUploaderProps {
  onFileSelect: (file: File, preview: string) => void
  selectedNetworks: string[]
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

export function MediaUploader({ onFileSelect, selectedNetworks }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [validation, setValidation] = useState<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>({ isValid: true, errors: [], warnings: [] })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): { isValid: boolean, errors: string[], warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    
    if (!isVideo && !isImage) {
      errors.push('Apenas vídeos e imagens são suportados')
      return { isValid: false, errors, warnings }
    }

    // TikTok-specific validation
    if (selectedNetworks.includes('tiktok')) {
      if (isVideo) {
        if (!TIKTOK_LIMITS.video.formats.includes(file.type)) {
          errors.push(`Formato de vídeo não suportado. Use: ${TIKTOK_LIMITS.video.formats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`)
        }
        if (file.size > TIKTOK_LIMITS.video.maxSize) {
          errors.push(`Vídeo muito grande. Máximo: ${TIKTOK_LIMITS.video.maxSize / (1024*1024*1024)}GB`)
        }
      } else if (isImage) {
        if (!TIKTOK_LIMITS.image.formats.includes(file.type)) {
          errors.push(`Formato de imagem não suportado. Use: ${TIKTOK_LIMITS.image.formats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`)
        }
        if (file.size > TIKTOK_LIMITS.image.maxSize) {
          errors.push(`Imagem muito grande. Máximo: ${TIKTOK_LIMITS.image.maxSize / (1024*1024)}MB`)
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file)
    setValidation(validation)
    
    if (!validation.isValid) {
      return
    }

    setUploadedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPreview(result)
      onFileSelect(file, result)
    }
    reader.readAsDataURL(file)
  }, [onFileSelect, selectedNetworks])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = () => {
    setUploadedFile(null)
    setPreview(null)
    setValidation({ isValid: true, errors: [], warnings: [] })
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
      
      {selectedNetworks.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Selecione pelo menos uma rede social para ver os requisitos de mídia
            </p>
          </div>
        </div>
      )}

      {!uploadedFile ? (
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
              {isDragging ? 'Solte o arquivo aqui' : 'Escolha um arquivo ou arraste aqui'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Suporta vídeos e imagens
            </p>
            
            {selectedNetworks.includes('tiktok') && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Vídeos:</strong> MP4, MOV, AVI • Máx: 500MB • 3s-10min</p>
                <p><strong>Imagens:</strong> JPG, PNG • Máx: 20MB</p>
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
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
            className="hidden"
          />
        </>
      ) : (
        <div className="space-y-4">
          {/* File Preview */}
          <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex-shrink-0">
              {getFileIcon(uploadedFile)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{uploadedFile.name}</h4>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(uploadedFile.size)} • {uploadedFile.type}
              </p>
              {validation.isValid && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400">
                    Arquivo válido
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={removeFile}
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="max-w-sm mx-auto">
              {uploadedFile.type.startsWith('video/') ? (
                <video
                  src={preview}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: '300px' }}
                >
                  Seu navegador não suporta vídeos.
                </video>
              ) : (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg object-contain"
                  style={{ maxHeight: '300px' }}
                />
              )}
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

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-2 border border-muted rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            Escolher outro arquivo
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}