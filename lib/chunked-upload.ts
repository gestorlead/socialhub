/**
 * Chunked file upload utility for large files
 * Breaks files into smaller chunks to bypass server payload limits
 */

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB threshold for chunked upload

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  currentChunk?: number
  totalChunks?: number
}

export interface UploadResult {
  filename: string
  originalName: string
  size: number
  type: string
  url: string
  path: string
}

/**
 * Upload a file using chunked upload for large files or regular upload for small files
 */
export async function uploadFile(
  file: File, 
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  
  if (file.size <= LARGE_FILE_THRESHOLD) {
    // Use regular upload for small files
    return uploadFileRegular(file, userId, onProgress)
  } else {
    // Use chunked upload for large files
    return uploadFileChunked(file, userId, onProgress)
  }
}

/**
 * Regular file upload (for small files)
 */
async function uploadFileRegular(
  file: File, 
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  
  const formData = new FormData()
  formData.append('file', file)
  formData.append('userId', userId)
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100)
        })
      }
    })
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText)
          if (result.success) {
            resolve(result.data)
          } else {
            reject(new Error(result.error || 'Upload failed'))
          }
        } catch (parseError) {
          reject(new Error('Invalid response from server'))
        }
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })
    
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

/**
 * Chunked file upload (for large files)
 */
async function uploadFileChunked(
  file: File, 
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const fileId = generateFileId()
  
  console.log(`[Chunked Upload] Starting upload of ${file.name} (${file.size} bytes) in ${totalChunks} chunks`)
  
  let uploadedBytes = 0
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    
    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('userId', userId)
    formData.append('fileName', file.name)
    formData.append('fileId', fileId)
    formData.append('chunkIndex', chunkIndex.toString())
    formData.append('totalChunks', totalChunks.toString())
    
    try {
      const response = await fetch('/api/upload/chunked', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`Chunk ${chunkIndex + 1} upload failed: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || `Chunk ${chunkIndex + 1} upload failed`)
      }
      
      uploadedBytes += chunk.size
      
      if (onProgress) {
        onProgress({
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
          currentChunk: chunkIndex + 1,
          totalChunks
        })
      }
      
      // If this was the last chunk and file is complete
      if (result.completed) {
        console.log(`[Chunked Upload] Completed upload of ${file.name}`)
        return result.data
      }
      
    } catch (error) {
      console.error(`[Chunked Upload] Error uploading chunk ${chunkIndex + 1}:`, error)
      throw error
    }
  }
  
  throw new Error('Upload completed but no final result received')
}

/**
 * Generate a unique file ID for chunked upload
 */
function generateFileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

/**
 * Upload multiple files with progress tracking
 */
export async function uploadMultipleFiles(
  files: File[], 
  userId: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<UploadResult[]> {
  
  const results: UploadResult[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      const result = await uploadFile(file, userId, (progress) => {
        if (onProgress) {
          onProgress(i, progress)
        }
      })
      
      results.push(result)
    } catch (error) {
      console.error(`Failed to upload file ${i + 1} (${file.name}):`, error)
      throw error
    }
  }
  
  return results
}