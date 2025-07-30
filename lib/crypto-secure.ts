import crypto from 'crypto'

// Use AES-256-GCM for secure encryption
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16  // 128 bits
const TAG_LENGTH = 16 // 128 bits

/**
 * Gets the encryption key from environment or generates a secure one
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.INTEGRATION_ENCRYPTION_KEY
  
  if (!keyEnv) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY environment variable is required')
  }
  
  // If key is hex-encoded, decode it
  if (keyEnv.length === KEY_LENGTH * 2 && /^[0-9a-fA-F]+$/.test(keyEnv)) {
    return Buffer.from(keyEnv, 'hex')
  }
  
  // Otherwise, derive key using PBKDF2
  const salt = Buffer.from('socialhub-salt-2025', 'utf8') // Use proper salt in production
  return crypto.pbkdf2Sync(keyEnv, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypts sensitive data using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipher(ALGORITHM, key)
    cipher.setAAD(Buffer.from('socialhub', 'utf8')) // Additional authenticated data
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    // Format: iv:tag:encrypted (all hex-encoded)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts data encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''
  
  try {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const [ivHex, tagHex, encryptedHex] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    
    const decipher = crypto.createDecipher(ALGORITHM, key)
    decipher.setAAD(Buffer.from('socialhub', 'utf8'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hashes data for secure storage (one-way) with salt
 */
export function hash(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHash('sha256')
  hash.update(data + actualSalt)
  return `${actualSalt}:${hash.digest('hex')}`
}

/**
 * Verifies a hash with the original data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const [salt, expectedHash] = hashedData.split(':')
    const actualHash = hash(data, salt)
    return safeCompare(actualHash, hashedData)
  } catch {
    return false
  }
}

/**
 * Generates a cryptographically secure random key
 */
export function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generates a secure state parameter for OAuth
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generates PKCE code verifier and challenge
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  
  return { codeVerifier, codeChallenge }
}

/**
 * Validates if a string is properly encrypted
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false
  
  try {
    const parts = data.split(':')
    return parts.length === 3 && 
           /^[0-9a-fA-F]+$/.test(parts[0]) && // IV is hex
           /^[0-9a-fA-F]+$/.test(parts[1]) && // Tag is hex
           /^[0-9a-fA-F]+$/.test(parts[2])    // Encrypted data is hex
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

/**
 * Verifies HMAC webhook signature
 */
export function verifyWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')
    
    const providedSignature = signature.replace('sha256=', '')
    return safeCompare(expectedSignature, providedSignature)
  } catch {
    return false
  }
}

/**
 * Creates HMAC signature for outgoing webhooks
 */
export function createWebhookSignature(payload: string, secret: string): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')
  
  return `sha256=${signature}`
}