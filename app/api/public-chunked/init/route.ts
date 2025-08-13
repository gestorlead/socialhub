import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Public API: Inicializar upload chunked sem autenticação
 * Cria diretório temporário para receber chunks
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Public Chunked Init] Starting public chunked upload initialization')
    
    const body = await request.json()
    const { fileName, fileSize, fileType, totalChunks, chunkSize } = body

    console.log('[Public Chunked Init] Request data:', {
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
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'public-debug')
    const tempDir = path.join(uploadsDir, 'temp', uploadId)
    
    try {
      await fs.mkdir(tempDir, { recursive: true })
      console.log('[Public Chunked Init] Created temp directory:', tempDir)
    } catch (error) {
      console.error('[Public Chunked Init] Failed to create temp directory:', error)
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
      tempDir,
      isPublicDebug: true
    }

    const metadataPath = path.join(tempDir, 'metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    console.log('[Public Chunked Init] Upload initialized successfully:', {
      uploadId,
      tempDir,
      expectedChunks: totalChunks
    })

    return NextResponse.json({
      success: true,
      uploadId,
      message: `Public chunked upload initialized for ${fileName}`,
      metadata: {
        tempDir,
        totalChunks,
        chunkSize,
        isPublicDebug: true
      }
    })

  } catch (error) {
    console.error('[Public Chunked Init] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize public chunked upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint para verificar se API está funcionando
export async function GET() {
  try {
    console.log('[Public Chunked Init] GET request - API health check')
    
    return NextResponse.json({
      status: 'ok',
      message: 'Public chunked init API is working',
      timestamp: new Date().toISOString(),
      isPublicDebug: true
    })
    
  } catch (error) {
    console.error('[Public Chunked Init] GET error:', error)
    return NextResponse.json({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configuração para operações de arquivo
export const runtime = 'nodejs'
export const maxDuration = 30