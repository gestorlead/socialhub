import { NextRequest, NextResponse } from 'next/server'

// Simple Instagram callback for Meta validation
export async function GET(request: NextRequest) {
  // Redirect to the actual callback handler
  const url = new URL(request.url)
  const newUrl = new URL('/api/auth/instagram/callback', url.origin)
  
  // Copy all search parameters
  url.searchParams.forEach((value, key) => {
    newUrl.searchParams.set(key, value)
  })
  
  return NextResponse.redirect(newUrl.toString())
}