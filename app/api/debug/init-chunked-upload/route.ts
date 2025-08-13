import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Debug API: Inicializar upload chunked
 * Cria diretório temporário para receber chunks
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Debug Init Chunked] Starting chunked upload initialization')
    
    const body = await request.json()
    const { fileName, fileSize, fileType, totalChunks, chunkSize } = body

    console.log('[Debug Init Chunked] Request data:', {
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      fileType,
      totalChunks,
      chunkSize: `${(chunkSize / 1024).toFixed(0)}KB`
    })

    if (!fileName || !fileSize || !totalChunks) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileName, fileSize, totalChunks' 
      }, { status: 400 })
    }

    // Gerar ID único para este upload
    const uploadId = crypto.randomBytes(16).toString('hex')
    
    // Criar diretório temporário para chunks
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    const tempDir = path.join(uploadsDir, 'temp', uploadId)
    
    try {
      await fs.mkdir(tempDir, { recursive: true })
      console.log('[Debug Init Chunked] Created temp directory:', tempDir)
    } catch (error) {
      console.error('[Debug Init Chunked] Failed to create temp directory:', error)
      throw new Error('Failed to create upload directory')
    }

    // Salvar metadados do upload
    const metadata = {
      uploadId,
      fileName,
      fileSize,
      fileType,
      totalChunks,
      chunkSize,
      chunksReceived: 0,
      startTime: new Date().toISOString(),
      tempDir
    }

    const metadataPath = path.join(tempDir, 'metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    console.log('[Debug Init Chunked] Upload initialized successfully:', {
      uploadId,
      tempDir,
      expectedChunks: totalChunks
    })

    return NextResponse.json({
      success: true,
      uploadId,
      message: `Chunked upload initialized for ${fileName}`,
      metadata: {
        tempDir,
        totalChunks,
        chunkSize
      }
    })

  } catch (error) {
    console.error('[Debug Init Chunked] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize chunked upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configuração para operações de arquivo
export const runtime = 'nodejs'
export const maxDuration = 30