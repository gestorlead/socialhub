import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'tiktok')
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB limit

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
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large',
        details: `Maximum file size is ${MAX_FILE_SIZE / (1024*1024)}MB`
      }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type',
        details: 'Only MP4, MOV, AVI videos and JPG, PNG images are allowed'
      }, { status: 400 })
    }
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomString = crypto.randomBytes(8).toString('hex')
    const extension = path.extname(file.name)
    const filename = `${userId}_${timestamp}_${randomString}${extension}`
    
    // Ensure upload directory exists
    await ensureUploadDir()
    
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Save file to disk
    const filepath = path.join(UPLOAD_DIR, filename)
    await writeFile(filepath, buffer)
    
    console.log(`[Upload API] File saved: ${filename} (${file.size} bytes)`)
    
    // Generate public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/uploads/tiktok/${filename}`
    
    return NextResponse.json({
      success: true,
      data: {
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl,
        path: `/uploads/tiktok/${filename}`
      }
    })
    
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
      const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/uploads/tiktok/${filename}`
      
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