import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Debug API: Finalizar upload chunked
 * Combina todos os chunks em um arquivo final
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Debug Finalize Chunked] Starting finalization')
    
    const body = await request.json()
    const { uploadId } = body

    if (!uploadId) {
      return NextResponse.json({ 
        error: 'Upload ID required' 
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
      console.error('[Debug Finalize Chunked] Failed to read metadata:', error)
      return NextResponse.json({ 
        error: 'Upload session not found or expired' 
      }, { status: 404 })
    }

    console.log('[Debug Finalize Chunked] Metadata:', {
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
    const finalFileName = `debug_${timestamp}_${randomString}${fileExtension}`
    const finalPath = path.join(process.cwd(), 'public', 'uploads', finalFileName)

    console.log('[Debug Finalize Chunked] Combining chunks into:', finalFileName)

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
          
          console.log('[Debug Finalize Chunked] Combined chunk:', {
            index: i,
            size: `${(chunkData.length / 1024).toFixed(1)}KB`,
            totalWritten: `${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB`
          })
        } catch (error) {
          console.error(`[Debug Finalize Chunked] Failed to read chunk ${i}:`, error)
          throw new Error(`Missing chunk ${i}`)
        }
      }
    } finally {
      await writeStream.close()
    }

    console.log('[Debug Finalize Chunked] File combination complete:', {
      finalPath,
      totalSize: `${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB`,
      expectedSize: `${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB`,
      sizeMatch: totalBytesWritten === metadata.fileSize
    })

    // Verificar integridade do arquivo final
    const fileStats = await fs.stat(finalPath)
    const sizeMatches = fileStats.size === metadata.fileSize

    if (!sizeMatches) {
      console.warn('[Debug Finalize Chunked] Size mismatch detected:', {
        expected: metadata.fileSize,
        actual: fileStats.size,
        difference: fileStats.size - metadata.fileSize
      })
    }

    // Limpar diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log('[Debug Finalize Chunked] Temp directory cleaned up')
    } catch (error) {
      console.warn('[Debug Finalize Chunked] Failed to clean temp directory:', error)
    }

    const endTime = new Date().toISOString()
    const duration = new Date(endTime).getTime() - new Date(metadata.startTime).getTime()

    const result = {
      success: true,
      fileName: finalFileName,
      originalName: metadata.fileName,
      size: fileStats.size,
      type: metadata.fileType,
      url: `/uploads/${finalFileName}`,
      path: `/uploads/${finalFileName}`,
      uploadId,
      chunksProcessed: metadata.totalChunks,
      duration: `${(duration / 1000).toFixed(1)}s`,
      sizeMatches,
      message: `File assembled successfully from ${metadata.totalChunks} chunks`
    }

    console.log('[Debug Finalize Chunked] Upload completed successfully:', result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Debug Finalize Chunked] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to finalize chunked upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Configuração para operações de arquivo
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutos para arquivos grandes