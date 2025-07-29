import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Need service role key for admin operations
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Check if avatars bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return NextResponse.json({ error: 'Failed to list buckets', details: listError }, { status: 500 })
    }

    const avatarsBucket = buckets?.find(bucket => bucket.name === 'avatars')
    
    if (!avatarsBucket) {
      // Create avatars bucket
      const { error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      })

      if (createError) {
        return NextResponse.json({ 
          error: 'Failed to create avatars bucket', 
          details: createError 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        message: 'Avatars bucket created successfully',
        bucket: 'avatars',
        created: true
      })
    }

    return NextResponse.json({ 
      message: 'Avatars bucket already exists',
      bucket: 'avatars',
      created: false
    })

  } catch (error) {
    console.error('Setup storage error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}