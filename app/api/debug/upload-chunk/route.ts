import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Debug API: Upload de chunk individual
 * Recebe e salva um chunk específico
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Debug Upload Chunk] Starting chunk upload')
    
    // Verificar Content-Length
    const contentLength = request.headers.get('content-length')
    console.log('[Debug Upload Chunk] Content-Length:', contentLength ? `${(parseInt(contentLength) / 1024).toFixed(1)}KB` : 'não informado')
    
    const formData = await request.formData()
    const chunk = formData.get('chunk') as File
    const uploadId = formData.get('uploadId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)

    console.log('[Debug Upload Chunk] Chunk data:', {
      uploadId,
      chunkIndex,
      totalChunks,
      chunkSize: chunk ? `${(chunk.size / 1024).toFixed(1)}KB` : 'no chunk',
      chunkType: chunk?.type || 'no type'
    })

    if (!chunk || !uploadId || chunkIndex === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: chunk, uploadId, chunkIndex' 
      }, { status: 400 })
    }

    // Localizar diretório temporário
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp', uploadId)
    const metadataPath = path.join(tempDir, 'metadata.json')
    
    let metadata
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      metadata = JSON.parse(metadataContent)
    } catch (error) {
      console.error('[Debug Upload Chunk] Failed to read metadata:', error)
      return NextResponse.json({ 
        error: 'Upload session not found or expired' 
      }, { status: 404 })
    }

    // Validar chunk
    if (chunkIndex >= totalChunks) {
      return NextResponse.json({ 
        error: `Invalid chunk index: ${chunkIndex} >= ${totalChunks}` 
      }, { status: 400 })
    }

    // Salvar chunk
    const chunkPath = path.join(tempDir, `chunk_${chunkIndex.toString().padStart(4, '0')}`)
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    
    await fs.writeFile(chunkPath, chunkBuffer)
    
    console.log('[Debug Upload Chunk] Chunk saved:', {
      path: chunkPath,
      size: `${(chunkBuffer.length / 1024).toFixed(1)}KB`,
      index: chunkIndex
    })

    // Atualizar metadados
    metadata.chunksReceived += 1
    metadata.lastChunkTime = new Date().toISOString()
    metadata.lastChunkIndex = chunkIndex
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    const progress = Math.round((metadata.chunksReceived / totalChunks) * 100)
    
    console.log('[Debug Upload Chunk] Progress:', {
      chunksReceived: metadata.chunksReceived,
      totalChunks,
      progress: `${progress}%`
    })

    return NextResponse.json({
      success: true,
      chunkIndex,
      chunksReceived: metadata.chunksReceived,
      totalChunks,
      progress,
      message: `Chunk ${chunkIndex} uploaded successfully`
    })

  } catch (error) {
    console.error('[Debug Upload Chunk] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to upload chunk',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configuração para operações de arquivo
export const runtime = 'nodejs'
export const maxDuration = 60