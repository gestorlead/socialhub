import { NextRequest, NextResponse } from 'next/server'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET(request: NextRequest) {
  try {
    const testString = 'test-secret-key-12345'
    
    console.log('[Crypto Test] Testing encryption/decryption...')
    console.log('[Crypto Test] Original:', testString)
    
    // Test encryption
    const encrypted = encrypt(testString)
    console.log('[Crypto Test] Encrypted:', encrypted)
    
    // Test decryption
    const decrypted = decrypt(encrypted)
    console.log('[Crypto Test] Decrypted:', decrypted)
    
    const success = testString === decrypted
    
    return NextResponse.json({
      success,
      original: testString,
      encrypted: encrypted,
      decrypted: decrypted,
      match: success
    })
    
  } catch (error) {
    console.error('[Crypto Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}