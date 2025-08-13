/**
 * Supabase Storage direct upload utility
 * Bypasses server limitations by uploading directly to storage
 */

export interface StorageUploadProgress {
  loaded: number
  total: number
  percentage: number
  speed?: number // bytes per second
  estimatedTimeRemaining?: number // seconds
}

export interface StorageUploadResult {
  filename: string
  originalName: string
  size: number
  type: string
  url: string
  path: string
  storage: 'supabase'
}

interface PresignedUploadData {
  originalName: string
  filename: string
  path: string
  uploadUrl: string
  token: string
  publicUrl: string
  size: number
  type: string
}

/**
 * Upload files directly to Supabase Storage using presigned URLs
 * Automatically uses chunked upload for large files
 */
export async function uploadToSupabaseStorage(
  files: File[],
  authToken: string,
  onProgress?: (fileIndex: number, progress: StorageUploadProgress) => void
): Promise<StorageUploadResult[]> {
  
  console.log(`[Supabase Storage Upload] Starting upload of ${files.length} files`)
  
  const results: StorageUploadResult[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    console.log(`[Supabase Storage Upload] Uploading file ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
    
    try {
      let result: StorageUploadResult
      
      // Use chunked upload for files larger than 1MB (conservative approach for Storage limits)
      if (file.size > 1 * 1024 * 1024) {
        console.log(`[Supabase Storage Upload] Using chunked upload for large file: ${file.name}`)
        result = await uploadLargeFileToStorage(file, authToken, (progress) => {
          if (onProgress) {
            onProgress(i, progress)
          }
        })
      } else {
        console.log(`[Supabase Storage Upload] Using direct upload for small file: ${file.name}`)
        // Step 1: Get presigned upload URL for small file
        const presignedData = await getPresignedUploadUrls([file], authToken)
        const uploadData = presignedData[0]
        
        result = await uploadFileToStorage(file, uploadData, (progress) => {
          if (onProgress) {
            onProgress(i, progress)
          }
        })
      }
      
      results.push(result)
      
    } catch (error) {
      console.error(`[Supabase Storage Upload] Failed to upload ${file.name}:`, error)
      throw new Error(`Upload failed for ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  console.log(`[Supabase Storage Upload] Successfully uploaded ${results.length} files`)
  return results
}

/**
 * Get presigned upload URLs from our API
 */
async function getPresignedUploadUrls(
  files: File[], 
  authToken: string
): Promise<PresignedUploadData[]> {
  
  const fileInfo = files.map(file => ({
    name: file.name,
    type: file.type,
    size: file.size
  }))
  
  const response = await fetch('/api/storage/presigned-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ files: fileInfo })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to get presigned URLs: ${errorData.error || response.statusText}`)
  }
  
  const result = await response.json()
  
  if (!result.success) {
    throw new Error(`Presigned URL generation failed: ${result.error}`)
  }
  
  return result.data
}

/**
 * Upload a single file directly to Supabase Storage
 */
async function uploadFileToStorage(
  file: File,
  uploadData: PresignedUploadData,
  onProgress?: (progress: StorageUploadProgress) => void
): Promise<StorageUploadResult> {
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const startTime = Date.now()
    
    // Progress tracking
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const elapsed = (Date.now() - startTime) / 1000
        const speed = event.loaded / elapsed
        const remaining = elapsed > 0 ? (event.total - event.loaded) / speed : 0
        
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
          speed: Math.round(speed),
          estimatedTimeRemaining: Math.round(remaining)
        })
      }
    })
    
    // Success handler
    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 201) {
        console.log(`[Supabase Storage Upload] Successfully uploaded ${file.name} to ${uploadData.path}`)
        
        resolve({
          filename: uploadData.filename,
          originalName: uploadData.originalName,
          size: file.size,
          type: file.type,
          url: uploadData.publicUrl,
          path: uploadData.path,
          storage: 'supabase'
        })
      } else {
        console.error(`[Supabase Storage Upload] Upload failed for ${file.name}:`, {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText
        })
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    })
    
    // Error handler
    xhr.addEventListener('error', () => {
      console.error(`[Supabase Storage Upload] Network error uploading ${file.name}`)
      reject(new Error('Network error during upload'))
    })
    
    // Timeout handler
    xhr.addEventListener('timeout', () => {
      console.error(`[Supabase Storage Upload] Timeout uploading ${file.name}`)
      reject(new Error('Upload timeout'))
    })
    
    // Configure request
    xhr.open('PUT', uploadData.uploadUrl)
    xhr.timeout = 10 * 60 * 1000 // 10 minutes timeout
    
    // Set required headers for Supabase Storage
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('Cache-Control', 'max-age=3600')
    
    // Start upload
    xhr.send(file)
  })
}

/**
 * Check if we should use storage upload based on file size
 * UPDATED: Now uses storage for ALL files to avoid local disk usage
 */
export function shouldUseStorageUpload(file: File): boolean {
  // Always use storage upload to avoid local disk usage
  return true
}

/**
 * Get upload method recommendation for multiple files
 */
export function getUploadStrategy(files: File[]): {
  storageFiles: File[]
  serverFiles: File[]
  recommendation: 'storage' | 'server' | 'mixed'
} {
  const storageFiles: File[] = []
  const serverFiles: File[] = []
  
  files.forEach(file => {
    if (shouldUseStorageUpload(file)) {
      storageFiles.push(file)
    } else {
      serverFiles.push(file)
    }
  })
  
  let recommendation: 'storage' | 'server' | 'mixed'
  if (storageFiles.length > 0 && serverFiles.length > 0) {
    recommendation = 'mixed'
  } else if (storageFiles.length > 0) {
    recommendation = 'storage'
  } else {
    recommendation = 'server'
  }
  
  return { storageFiles, serverFiles, recommendation }
}

/**
 * Upload large files to Supabase Storage using chunked upload
 */
async function uploadLargeFileToStorage(
  file: File,
  authToken: string,
  onProgress?: (progress: StorageUploadProgress) => void
): Promise<StorageUploadResult> {
  
  const CHUNK_SIZE = 500 * 1024 // 500KB chunks for Storage (very conservative)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  
  console.log(`[Storage Chunked Upload] Starting chunked upload: ${file.name} (${totalChunks} chunks)`)
  
  // Generate unique filename
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = file.name.substring(file.name.lastIndexOf('.'))
  const filename = `chunked_${timestamp}_${randomString}${extension}`
  const filePath = `uploads/${filename}`
  
  const uploadedChunks: string[] = []
  let uploadedBytes = 0
  
  // Upload each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    
    console.log(`[Storage Chunked Upload] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.size} bytes)`)
    
    try {
      // Create chunk-specific path
      const chunkPath = `${filePath}.chunk.${chunkIndex}`
      
      // Get presigned URL for this chunk
      const chunkFile = new File([chunk], `chunk_${chunkIndex}`, { type: file.type })
      const presignedData = await getPresignedUploadUrlForPath(chunkFile, chunkPath, authToken)
      
      // Upload chunk
      await uploadChunkToStorage(chunk, presignedData, file.type)
      
      uploadedChunks.push(chunkPath)
      uploadedBytes += chunk.size
      
      // Report progress
      if (onProgress) {
        onProgress({
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
          speed: 0, // Calculate if needed
          estimatedTimeRemaining: 0 // Calculate if needed
        })
      }
      
    } catch (error) {
      console.error(`[Storage Chunked Upload] Failed to upload chunk ${chunkIndex}:`, error)
      throw new Error(`Chunk upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // After all chunks uploaded, combine them
  console.log(`[Storage Chunked Upload] All chunks uploaded, combining...`)
  
  try {
    const combineResponse = await fetch('/api/storage/combine-chunks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        chunkPaths: uploadedChunks,
        finalPath: filePath,
        totalSize: file.size
      })
    })
    
    if (!combineResponse.ok) {
      const errorData = await combineResponse.json().catch(() => ({}))
      throw new Error(`Failed to combine chunks: ${errorData.error || combineResponse.statusText}`)
    }
    
    const combineResult = await combineResponse.json()
    
    if (!combineResult.success) {
      throw new Error(`Chunk combination failed: ${combineResult.error}`)
    }
    
    console.log(`[Storage Chunked Upload] Successfully combined chunks into: ${filePath}`)
    
    return {
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: combineResult.data.publicUrl,
      path: filePath,
      storage: 'supabase'
    }
    
  } catch (combineError) {
    console.error(`[Storage Chunked Upload] Failed to combine chunks:`, combineError)
    throw new Error(`Chunk combination failed: ${combineError instanceof Error ? combineError.message : 'Unknown error'}`)
  }
}

/**
 * Get presigned upload URL for a specific path
 */
async function getPresignedUploadUrlForPath(
  file: File,
  path: string,
  authToken: string
): Promise<PresignedUploadData> {
  
  const response = await fetch('/api/storage/presigned-upload-path', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ 
      file: {
        name: file.name,
        type: file.type,
        size: file.size
      },
      path: path
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to get presigned URL for path: ${errorData.error || response.statusText}`)
  }
  
  const result = await response.json()
  
  if (!result.success) {
    throw new Error(`Presigned URL generation failed: ${result.error}`)
  }
  
  return result.data
}

/**
 * Upload a chunk directly to storage
 */
async function uploadChunkToStorage(
  chunk: Blob,
  uploadData: PresignedUploadData,
  contentType: string
): Promise<void> {
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 201) {
        resolve()
      } else {
        reject(new Error(`Chunk upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during chunk upload'))
    })
    
    xhr.open('PUT', uploadData.uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    
    xhr.send(chunk)
  })
}