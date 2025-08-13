import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Configure for large file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large files

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    console.log('[Internal Upload] Upload directory ensured:', UPLOAD_DIR)
  } catch (error) {
    console.error('[Internal Upload] Error creating upload directory:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[Internal Upload] ===== STARTING UPLOAD DEBUG =====')
    console.log('[Internal Upload] Request URL:', request.url)
    console.log('[Internal Upload] Request method:', request.method)
    
    // Log headers detalhados
    const headers = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })
    console.log('[Internal Upload] Request headers:', JSON.stringify(headers, null, 2))
    
    // Verificar Content-Length
    const contentLength = request.headers.get('content-length')
    const contentType = request.headers.get('content-type')
    console.log('[Internal Upload] Content-Length:', contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB` : 'não informado')
    console.log('[Internal Upload] Content-Type:', contentType)
    
    // Verificar se é multipart/form-data
    if (!contentType?.includes('multipart/form-data')) {
      console.error('[Internal Upload] Invalid content type:', contentType)
      return NextResponse.json({ 
        error: 'Content-Type must be multipart/form-data',
        received: contentType
      }, { status: 400 })
    }
    
    console.log('[Internal Upload] Parsing form data...')
    const parseStartTime = Date.now()
    
    let formData
    try {
      formData = await request.formData()
      const parseTime = Date.now() - parseStartTime
      console.log('[Internal Upload] Form data parsed successfully in', parseTime, 'ms')
    } catch (parseError) {
      console.error('[Internal Upload] Form data parse error:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse form data',
        details: parseError instanceof Error ? parseError.message : 'Parse error'
      }, { status: 400 })
    }
    
    // Log todos os campos do form
    const formFields = {}
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        formFields[key] = {
          type: 'File',
          name: value.name,
          size: `${(value.size / 1024 / 1024).toFixed(2)}MB`,
          mimeType: value.type
        }
      } else {
        formFields[key] = {
          type: 'String',
          value: value.toString()
        }
      }
    }
    console.log('[Internal Upload] Form fields:', JSON.stringify(formFields, null, 2))
    
    const userId = formData.get('userId') as string
    
    if (!userId) {
      console.error('[Internal Upload] Missing userId')
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Coletar todos os arquivos
    const files: File[] = []
    
    // Verificar campo 'files' (múltiplos arquivos)
    const filesField = formData.getAll('files')
    for (const file of filesField) {
      if (file instanceof File) {
        files.push(file)
      }
    }
    
    // Verificar campo 'file' (arquivo único)
    const singleFile = formData.get('file') as File
    if (singleFile instanceof File) {
      files.push(singleFile)
    }
    
    // Verificar campos numerados (file0, file1, etc.)
    let index = 0
    while (true) {
      const indexedFile = formData.get(`file${index}`) as File
      if (!indexedFile || !(indexedFile instanceof File)) break
      files.push(indexedFile)
      index++
    }
    
    console.log('[Internal Upload] Files detected:', files.length)
    
    if (files.length === 0) {
      console.error('[Internal Upload] No files found in form data')
      return NextResponse.json({ 
        error: 'No files provided',
        formFields: Object.keys(formFields)
      }, { status: 400 })
    }
    
    // Log detalhes de cada arquivo
    files.forEach((file, i) => {
      console.log(`[Internal Upload] File ${i + 1}:`, {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      })
    })
    
    // Processar cada arquivo
    const uploadedFiles = []
    
    await ensureUploadDir()
    
    for (const [index, currentFile] of files.entries()) {
      console.log(`[Internal Upload] Processing file ${index + 1}/${files.length}: ${currentFile.name}`)
      
      const fileStartTime = Date.now()
      
      // Validar tipo de arquivo
      const allowedTypes = [
        'video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/x-msvideo',
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4',
        'application/pdf', 'text/plain', 'application/octet-stream'
      ]
      
      if (!allowedTypes.includes(currentFile.type)) {
        console.warn(`[Internal Upload] File type not in allowed list: ${currentFile.type}`)
        // Para debug, vamos permitir qualquer tipo
        console.log('[Internal Upload] Allowing file type for debug purposes')
      }
      
      // Gerar nome único
      const timestamp = Date.now()
      const randomString = crypto.randomBytes(8).toString('hex')
      const extension = path.extname(currentFile.name) || '.bin'
      const filename = `${userId}_${timestamp}_${randomString}_${index}${extension}`
      
      console.log(`[Internal Upload] Generated filename: ${filename}`)
      
      try {
        // Converter arquivo para buffer
        console.log(`[Internal Upload] Converting file to buffer...`)
        const bufferStartTime = Date.now()
        const buffer = Buffer.from(await currentFile.arrayBuffer())
        const bufferTime = Date.now() - bufferStartTime
        
        console.log(`[Internal Upload] Buffer created in ${bufferTime}ms, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`)
        
        // Salvar arquivo no disco
        const filepath = path.join(UPLOAD_DIR, filename)
        console.log(`[Internal Upload] Saving to: ${filepath}`)
        
        const writeStartTime = Date.now()
        await writeFile(filepath, buffer)
        const writeTime = Date.now() - writeStartTime
        
        console.log(`[Internal Upload] File written to disk in ${writeTime}ms`)
        
        // Gerar URL pública
        const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uploads/${filename}`
        
        const fileProcessTime = Date.now() - fileStartTime
        
        const fileResult = {
          filename,
          originalName: currentFile.name,
          size: currentFile.size,
          type: currentFile.type,
          url: publicUrl,
          path: `/uploads/${filename}`,
          processingTime: `${fileProcessTime}ms`
        }
        
        uploadedFiles.push(fileResult)
        
        console.log(`[Internal Upload] File ${index + 1} processed successfully:`, {
          filename,
          size: `${(currentFile.size / 1024 / 1024).toFixed(2)}MB`,
          processingTime: `${fileProcessTime}ms`
        })
        
      } catch (fileError) {
        console.error(`[Internal Upload] Error processing file ${index + 1}:`, fileError)
        return NextResponse.json({ 
          error: `Failed to process file ${index + 1}: ${currentFile.name}`,
          details: fileError instanceof Error ? fileError.message : 'File processing error'
        }, { status: 500 })
      }
    }
    
    const totalTime = Date.now() - startTime
    
    console.log('[Internal Upload] Upload completed successfully:', {
      filesProcessed: uploadedFiles.length,
      totalTime: `${totalTime}ms`,
      averageTimePerFile: `${Math.round(totalTime / uploadedFiles.length)}ms`
    })
    
    console.log('[Internal Upload] ===== UPLOAD DEBUG COMPLETE =====')
    
    // Retornar resultado
    const result = {
      success: true,
      data: files.length === 1 ? uploadedFiles[0] : uploadedFiles,
      metadata: {
        filesProcessed: uploadedFiles.length,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    
    console.error('[Internal Upload] ===== UPLOAD ERROR =====')
    console.error('[Internal Upload] Error details:', error)
    console.error('[Internal Upload] Error type:', error?.constructor?.name)
    console.error('[Internal Upload] Total time before error:', `${totalTime}ms`)
    
    if (error instanceof Error) {
      console.error('[Internal Upload] Error message:', error.message)
      console.error('[Internal Upload] Error stack:', error.stack)
    }
    
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      timeBeforeError: `${totalTime}ms`
    }, { status: 500 })
  }
}

// GET endpoint para verificar se arquivo existe
export async function GET(request: NextRequest) {
  try {
    console.log('[Internal Upload] GET request for file check')
    
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }
    
    const filepath = path.join(UPLOAD_DIR, filename)
    const { access } = await import('fs/promises')
    
    try {
      await access(filepath)
      const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uploads/${filename}`
      
      console.log('[Internal Upload] File exists:', filename)
      
      return NextResponse.json({
        exists: true,
        url: publicUrl,
        filename
      })
    } catch {
      console.log('[Internal Upload] File does not exist:', filename)
      
      return NextResponse.json({
        exists: false,
        filename
      })
    }
    
  } catch (error) {
    console.error('[Internal Upload] Error checking file:', error)
    return NextResponse.json({ 
      error: 'Check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}