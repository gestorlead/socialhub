import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { PRACTICAL_MAX_FILE_SIZE } from '@/lib/platform-limits'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
// Use practical maximum (5GB) instead of artificial 500MB limit
// Platform-specific validation will happen during publication enqueuing
const MAX_FILE_SIZE = PRACTICAL_MAX_FILE_SIZE // 5GB - covers all platform limits

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating upload directory:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] Starting file upload')
    
    // Parse multipart form data
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Check for single file (TikTok) or multiple files (Instagram)
    const file = formData.get('file') as File
    const files: File[] = []
    
    if (file) {
      // Single file upload (TikTok)
      files.push(file)
    } else {
      // Multiple file upload (Instagram) - check for file0, file1, etc.
      let index = 0
      while (true) {
        const indexedFile = formData.get(`file${index}`) as File
        if (!indexedFile) break
        files.push(indexedFile)
        index++
      }
    }
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    
    // Process all files
    const uploadedFiles = []
    
    for (const [index, currentFile] of files.entries()) {
      // Validate file size (general upload limit - platform-specific validation happens during enqueuing)
      if (currentFile.size > MAX_FILE_SIZE) {
        const limitGB = Math.round(MAX_FILE_SIZE / (1024*1024*1024))
        return NextResponse.json({ 
          error: 'File too large',
          details: `File ${index + 1}: Maximum file size is ${limitGB}GB. Platform-specific limits will be validated during publication.`
        }, { status: 400 })
      }
      
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(currentFile.type)) {
        return NextResponse.json({ 
          error: 'Invalid file type',
          details: `File ${index + 1}: Only MP4, MOV, AVI videos and JPG, PNG images are allowed`
        }, { status: 400 })
      }
      
      // Generate unique filename
      const timestamp = Date.now()
      const randomString = crypto.randomBytes(8).toString('hex')
      const extension = path.extname(currentFile.name)
      const filename = `${userId}_${timestamp}_${randomString}_${index}${extension}`
      
      // Ensure upload directory exists
      await ensureUploadDir()
      
      // Convert file to buffer
      const buffer = Buffer.from(await currentFile.arrayBuffer())
      
      // Save file to disk
      const filepath = path.join(UPLOAD_DIR, filename)
      await writeFile(filepath, buffer)
      
      console.log(`[Upload API] File ${index + 1} saved: ${filename} (${currentFile.size} bytes)`)
      
      // Generate public URL
      const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/uploads/${filename}`
      
      uploadedFiles.push({
        filename,
        originalName: currentFile.name,
        size: currentFile.size,
        type: currentFile.type,
        url: publicUrl,
        path: `/uploads/${filename}`
      })
    }
    
    // Return single file or array based on upload count
    if (files.length === 1) {
      // Single file (TikTok compatibility)
      return NextResponse.json({
        success: true,
        data: uploadedFiles[0]
      })
    } else {
      // Multiple files (Instagram)
      return NextResponse.json({
        success: true,
        data: uploadedFiles
      })
    }
    
  } catch (error) {
    console.error('[Upload API] Error:', error)
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check if file exists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }
    
    const filepath = path.join(UPLOAD_DIR, filename)
    const { access } = await import('fs/promises')
    
    try {
      await access(filepath)
      const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/uploads/${filename}`
      
      return NextResponse.json({
        exists: true,
        url: publicUrl,
        filename
      })
    } catch {
      return NextResponse.json({
        exists: false,
        filename
      })
    }
    
  } catch (error) {
    console.error('[Upload API] Error checking file:', error)
    return NextResponse.json({ 
      error: 'Check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}