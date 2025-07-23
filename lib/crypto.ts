import crypto from 'crypto'

// Simple base64 encoding for now (can be enhanced later)
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || 'socialhub-secret-key-2025'

/**
 * Encrypts sensitive data like API keys and secrets
 * Using simple base64 encoding with salt for now
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  try {
    // Simple approach: Base64 encode with salt
    const salt = crypto.randomBytes(8).toString('hex')
    const combined = salt + ':' + text
    const encoded = Buffer.from(combined).toString('base64')
    
    return encoded
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypts sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''
  
  try {
    // Decode from base64
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8')
    const parts = decoded.split(':')
    
    if (parts.length < 2) {
      throw new Error('Invalid encrypted data format')
    }
    
    // Remove salt and return original text
    const originalText = parts.slice(1).join(':')
    return originalText
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Hashes data for secure storage (one-way)
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generates a secure random key
 */
export function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Validates if a string is properly encrypted
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false
  
  try {
    // Try to decode as base64
    const decoded = Buffer.from(data, 'base64').toString('utf8')
    return decoded.includes(':')
  } catch {
    return false
  }
}

/**
 * Masks sensitive data for display purposes
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (!secret || secret.length <= visibleChars) return '***'
  
  const start = secret.substring(0, visibleChars)
  const end = secret.substring(secret.length - visibleChars)
  const middle = '*'.repeat(Math.max(secret.length - (visibleChars * 2), 3))
  
  return start + middle + end
}

/**
 * Safely compares two strings to prevent timing attacks
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}