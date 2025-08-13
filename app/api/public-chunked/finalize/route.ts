import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Public API: Finalizar upload chunked sem autenticação
 * Combina todos os chunks em um arquivo final
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Public Chunked Finalize] Starting public finalization')
    
    const body = await request.json()
    const { uploadId } = body

    if (!uploadId) {
      return NextResponse.json({ 
        error: 'Upload ID required' 
      }, { status: 400 })
    }

    // Localizar diretório temporário
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'public-debug', 'temp', uploadId)
    const metadataPath = path.join(tempDir, 'metadata.json')
    
    let metadata
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      metadata = JSON.parse(metadataContent)
    } catch (error) {
      console.error('[Public Chunked Finalize] Failed to read metadata:', error)
      return NextResponse.json({ 
        error: 'Upload session not found or expired' 
      }, { status: 404 })
    }

    console.log('[Public Chunked Finalize] Metadata:', {
      uploadId,
      fileName: metadata.fileName,
      expectedSize: `${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB`,
      totalChunks: metadata.totalChunks,
      chunksReceived: metadata.chunksReceived
    })

    // Verificar se todos os chunks foram recebidos
    if (metadata.chunksReceived !== metadata.totalChunks) {
      return NextResponse.json({ 
        error: `Incomplete upload: received ${metadata.chunksReceived}/${metadata.totalChunks} chunks` 
      }, { status: 400 })
    }

    // Gerar nome único para arquivo final
    const timestamp = Date.now()
    const randomString = crypto.randomBytes(8).toString('hex')
    const fileExtension = path.extname(metadata.fileName)
    const finalFileName = `public_debug_${timestamp}_${randomString}${fileExtension}`
    const finalPath = path.join(process.cwd(), 'public', 'uploads', 'public-debug', finalFileName)

    console.log('[Public Chunked Finalize] Combining chunks into:', finalFileName)

    // Combinar chunks em ordem
    const writeStream = await fs.open(finalPath, 'w')
    let totalBytesWritten = 0

    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i.toString().padStart(4, '0')}`)
        
        try {
          const chunkData = await fs.readFile(chunkPath)
          await writeStream.write(chunkData)
          totalBytesWritten += chunkData.length
          
          console.log('[Public Chunked Finalize] Combined chunk:', {
            index: i,
            size: `${(chunkData.length / 1024).toFixed(1)}KB`,
            totalWritten: `${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB`
          })
        } catch (error) {
          console.error(`[Public Chunked Finalize] Failed to read chunk ${i}:`, error)
          throw new Error(`Missing chunk ${i}`)
        }
      }
    } finally {
      await writeStream.close()
    }

    console.log('[Public Chunked Finalize] File combination complete:', {
      finalPath,
      totalSize: `${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB`,
      expectedSize: `${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB`,
      sizeMatch: totalBytesWritten === metadata.fileSize
    })

    // Verificar integridade do arquivo final
    const fileStats = await fs.stat(finalPath)
    const sizeMatches = fileStats.size === metadata.fileSize

    if (!sizeMatches) {
      console.warn('[Public Chunked Finalize] Size mismatch detected:', {
        expected: metadata.fileSize,
        actual: fileStats.size,
        difference: fileStats.size - metadata.fileSize
      })
    }

    // Limpar diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log('[Public Chunked Finalize] Temp directory cleaned up')
    } catch (error) {
      console.warn('[Public Chunked Finalize] Failed to clean temp directory:', error)
    }

    const endTime = new Date().toISOString()
    const duration = new Date(endTime).getTime() - new Date(metadata.startTime).getTime()

    // Gerar URL pública
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uploads/public-debug/${finalFileName}`

    const result = {
      success: true,
      fileName: finalFileName,
      originalName: metadata.fileName,
      size: fileStats.size,
      type: metadata.fileType,
      url: publicUrl,
      path: `/uploads/public-debug/${finalFileName}`,
      uploadId,
      chunksProcessed: metadata.totalChunks,
      duration: `${(duration / 1000).toFixed(1)}s`,
      sizeMatches,
      message: `Public file assembled successfully from ${metadata.totalChunks} chunks`,
      isPublicDebug: true
    }

    console.log('[Public Chunked Finalize] Public upload completed successfully:', result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Public Chunked Finalize] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to finalize public chunked upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint para verificar se API está funcionando
export async function GET() {
  try {
    console.log('[Public Chunked Finalize] GET request - API health check')
    
    return NextResponse.json({
      status: 'ok',
      message: 'Public chunked finalize API is working',
      timestamp: new Date().toISOString(),
      isPublicDebug: true
    })
    
  } catch (error) {
    console.error('[Public Chunked Finalize] GET error:', error)
    return NextResponse.json({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configuração para operações de arquivo
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutos para arquivos grandes