import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, appendFile, access } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Configure for chunked file uploads
export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute per chunk

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const CHUNK_DIR = path.join(process.cwd(), 'public', 'chunks')

// Ensure directories exist
async function ensureDirs() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    await mkdir(CHUNK_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating directories:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Chunked Upload API] Starting chunk upload')
    console.log('[Chunked Upload API] Request headers:', Object.fromEntries(request.headers.entries()))
    console.log('[Chunked Upload API] Content-Length:', request.headers.get('content-length'))
    
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const fileName = formData.get('fileName') as string
    const fileId = formData.get('fileId') as string
    const chunk = formData.get('chunk') as File
    
    console.log('[Chunked Upload API] Received chunk details:')
    console.log(`  - Chunk ${chunkIndex + 1}/${totalChunks}`)
    console.log(`  - File name: ${fileName}`)
    console.log(`  - Chunk size: ${chunk?.size} bytes`)
    console.log(`  - User ID: ${userId}`)
    
    if (!userId || !fileName || !fileId || !chunk || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, fileName, fileId, chunk, chunkIndex, totalChunks' 
      }, { status: 400 })
    }
    
    await ensureDirs()
    
    // Save chunk
    const chunkPath = path.join(CHUNK_DIR, `${fileId}_${chunkIndex}`)
    const buffer = Buffer.from(await chunk.arrayBuffer())
    await writeFile(chunkPath, buffer)
    
    console.log(`[Chunked Upload API] Saved chunk ${chunkIndex + 1}/${totalChunks} for file: ${fileName}`)
    
    // Check if all chunks are uploaded
    const allChunksUploaded = await checkAllChunksUploaded(fileId, totalChunks)
    
    if (allChunksUploaded) {
      // Merge chunks into final file
      const finalFile = await mergeChunks(fileId, fileName, userId, totalChunks)
      
      return NextResponse.json({
        success: true,
        completed: true,
        data: finalFile
      })
    } else {
      return NextResponse.json({
        success: true,
        completed: false,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`
      })
    }
    
  } catch (error) {
    console.error('[Chunked Upload API] Error:', error)
    return NextResponse.json({ 
      error: 'Chunk upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function checkAllChunksUploaded(fileId: string, totalChunks: number): Promise<boolean> {
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(CHUNK_DIR, `${fileId}_${i}`)
    try {
      await access(chunkPath)
    } catch {
      return false
    }
  }
  return true
}

async function mergeChunks(fileId: string, originalFileName: string, userId: string, totalChunks: number) {
  const timestamp = Date.now()
  const randomString = crypto.randomBytes(8).toString('hex')
  const extension = path.extname(originalFileName)
  const filename = `${userId}_${timestamp}_${randomString}${extension}`
  const finalPath = path.join(UPLOAD_DIR, filename)
  
  // Create empty final file
  await writeFile(finalPath, Buffer.alloc(0))
  
  // Append all chunks in order
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(CHUNK_DIR, `${fileId}_${i}`)
    const chunkBuffer = await import('fs/promises').then(fs => fs.readFile(chunkPath))
    await appendFile(finalPath, chunkBuffer)
    
    // Clean up chunk file
    await import('fs/promises').then(fs => fs.unlink(chunkPath)).catch(() => {})
  }
  
  console.log(`[Chunked Upload API] Merged ${totalChunks} chunks into: ${filename}`)
  
  // Get file stats
  const stats = await import('fs/promises').then(fs => fs.stat(finalPath))
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/uploads/${filename}`
  
  return {
    filename,
    originalName: originalFileName,
    size: stats.size,
    type: getContentType(extension),
    url: publicUrl,
    path: `/uploads/${filename}`
  }
}

function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/mov',
    '.avi': 'video/avi',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  }
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream'
}