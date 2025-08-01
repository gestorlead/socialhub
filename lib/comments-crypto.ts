import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync, timingSafeEqual } from 'crypto'

/**
 * Advanced AES-256-GCM encryption for sensitive data
 * Used specifically for comments system token encryption and sensitive data
 */
export class CommentsCrypto {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly IV_LENGTH = 16 // 128 bits
  private static readonly TAG_LENGTH = 16 // 128 bits
  private static readonly SALT_LENGTH = 32 // 256 bits
  private static readonly ITERATIONS = 100000 // PBKDF2 iterations

  /**
   * Get master key from environment or generate
   */
  private static getMasterKey(): Buffer {
    const envKey = process.env.COMMENTS_ENCRYPTION_KEY
    
    if (!envKey) {
      throw new Error('COMMENTS_ENCRYPTION_KEY environment variable is required')
    }

    if (envKey.length !== 64) { // 32 bytes = 64 hex chars
      throw new Error('COMMENTS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    }

    return Buffer.from(envKey, 'hex')
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private static deriveKey(salt: Buffer): Buffer {
    const masterKey = this.getMasterKey()
    return pbkdf2Sync(masterKey, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256')
  }

  /**
   * Encrypt sensitive data with AES-256-GCM
   */
  static encrypt(plaintext: string, additionalData?: string): string {
    try {
      if (!plaintext) {
        throw new Error('Plaintext cannot be empty')
      }

      // Generate random salt and IV
      const salt = randomBytes(this.SALT_LENGTH)
      const iv = randomBytes(this.IV_LENGTH)
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt)
      
      // Create cipher
      const cipher = createCipheriv(this.ALGORITHM, key, iv)
      
      // Set additional authenticated data if provided
      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData, 'utf8'))
      }
      
      // Encrypt
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ])
      
      // Get authentication tag
      const tag = cipher.getAuthTag()
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([salt, iv, tag, encrypted])
      
      // Return as base64
      return combined.toString('base64')
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt data encrypted with encrypt()
   */
  static decrypt(encryptedData: string, additionalData?: string): string {
    try {
      if (!encryptedData) {
        throw new Error('Encrypted data cannot be empty')
      }

      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64')
      
      if (combined.length < this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH + 1) {
        throw new Error('Invalid encrypted data format')
      }

      // Extract components
      let offset = 0
      const salt = combined.subarray(offset, offset + this.SALT_LENGTH)
      offset += this.SALT_LENGTH
      
      const iv = combined.subarray(offset, offset + this.IV_LENGTH)
      offset += this.IV_LENGTH
      
      const tag = combined.subarray(offset, offset + this.TAG_LENGTH)
      offset += this.TAG_LENGTH
      
      const encrypted = combined.subarray(offset)
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt)
      
      // Create decipher
      const decipher = createDecipheriv(this.ALGORITHM, key, iv)
      decipher.setAuthTag(tag)
      
      // Set additional authenticated data if provided
      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, 'utf8'))
      }
      
      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ])
      
      return decrypted.toString('utf8')
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Encrypt OAuth tokens with user context
   */
  static encryptToken(token: string, userId: string, platform: string): string {
    const additionalData = `${userId}:${platform}`
    return this.encrypt(token, additionalData)
  }

  /**
   * Decrypt OAuth tokens with user context verification
   */
  static decryptToken(encryptedToken: string, userId: string, platform: string): string {
    const additionalData = `${userId}:${platform}`
    return this.decrypt(encryptedToken, additionalData)
  }

  /**
   * Encrypt sensitive comment data
   */
  static encryptCommentData(data: string, commentId: string): string {
    const additionalData = `comment:${commentId}`
    return this.encrypt(data, additionalData)
  }

  /**
   * Decrypt sensitive comment data
   */
  static decryptCommentData(encryptedData: string, commentId: string): string {
    const additionalData = `comment:${commentId}`
    return this.decrypt(encryptedData, additionalData)
  }

  /**
   * Generate secure hash for content deduplication
   */
  static hashContent(content: string, userId: string): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256')
    hash.update(content)
    hash.update(userId) // Include user context
    return hash.digest('hex')
  }

  /**
   * Verify content hash in constant time
   */
  static verifyContentHash(content: string, userId: string, expectedHash: string): boolean {
    try {
      const actualHash = this.hashContent(content, userId)
      const expected = Buffer.from(expectedHash, 'hex')
      const actual = Buffer.from(actualHash, 'hex')
      
      // Constant-time comparison to prevent timing attacks
      return expected.length === actual.length && timingSafeEqual(expected, actual)
    } catch (error) {
      console.error('Hash verification failed:', error)
      return false
    }
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex')
  }

  /**
   * Generate API key with specific format
   */
  static generateAPIKey(): string {
    const prefix = 'shc_' // Social Hub Comments
    const timestamp = Date.now().toString(36)
    const random = randomBytes(16).toString('hex')
    return `${prefix}${timestamp}_${random}`
  }

  /**
   * Validate encryption key format
   */
  static validateEncryptionKey(key: string): boolean {
    if (!key || typeof key !== 'string') return false
    if (key.length !== 64) return false
    return /^[a-fA-F0-9]{64}$/.test(key)
  }

  /**
   * Generate new encryption key
   */
  static generateEncryptionKey(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Encrypt multiple fields in an object
   */
  static encryptFields<T extends Record<string, any>>(
    obj: T, 
    fields: (keyof T)[], 
    context: string
  ): T {
    const result = { ...obj }
    
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string, context)
      }
    }
    
    return result
  }

  /**
   * Decrypt multiple fields in an object
   */
  static decryptFields<T extends Record<string, any>>(
    obj: T, 
    fields: (keyof T)[], 
    context: string
  ): T {
    const result = { ...obj }
    
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.decrypt(result[field] as string, context)
        } catch (error) {
          console.error(`Failed to decrypt field ${String(field)}:`, error)
          result[field] = '[DECRYPTION_FAILED]' as any
        }
      }
    }
    
    return result
  }

  /**
   * Create encrypted backup of sensitive data
   */
  static createEncryptedBackup(data: any, backupId: string): string {
    const serialized = JSON.stringify(data)
    return this.encrypt(serialized, `backup:${backupId}:${Date.now()}`)
  }

  /**
   * Restore from encrypted backup
   */
  static restoreFromEncryptedBackup(encryptedBackup: string, backupId: string): any {
    try {
      // Try with current timestamp (for recent backups)
      const currentTime = Date.now()
      const timeWindow = 24 * 60 * 60 * 1000 // 24 hours
      
      for (let i = 0; i < timeWindow; i += 60000) { // Check every minute
        try {
          const testTime = currentTime - i
          const testContext = `backup:${backupId}:${testTime}`
          const decrypted = this.decrypt(encryptedBackup, testContext)
          return JSON.parse(decrypted)
        } catch (error) {
          // Continue trying different timestamps
        }
      }
      
      throw new Error('Could not restore backup - timestamp verification failed')
    } catch (error) {
      console.error('Backup restoration failed:', error)
      throw new Error('Failed to restore encrypted backup')
    }
  }
}

/**
 * Key rotation utilities
 */
export class KeyRotation {
  /**
   * Rotate encryption key for existing data
   */
  static async rotateKey(
    oldData: string[], 
    context: string,
    oldKeyEnv: string = 'COMMENTS_ENCRYPTION_KEY_OLD'
  ): Promise<string[]> {
    const oldKey = process.env[oldKeyEnv]
    if (!oldKey) {
      throw new Error(`Old encryption key not found in ${oldKeyEnv}`)
    }

    const results: string[] = []
    
    for (const encryptedData of oldData) {
      try {
        // Temporarily set old key
        const currentKey = process.env.COMMENTS_ENCRYPTION_KEY
        process.env.COMMENTS_ENCRYPTION_KEY = oldKey
        
        // Decrypt with old key
        const plaintext = CommentsCrypto.decrypt(encryptedData, context)
        
        // Restore new key
        process.env.COMMENTS_ENCRYPTION_KEY = currentKey
        
        // Encrypt with new key
        const newEncrypted = CommentsCrypto.encrypt(plaintext, context)
        results.push(newEncrypted)
      } catch (error) {
        console.error('Key rotation failed for item:', error)
        throw new Error('Key rotation failed')
      }
    }

    return results
  }

  /**
   * Verify key rotation was successful
   */
  static verifyRotation(
    originalCount: number, 
    rotatedData: string[], 
    context: string
  ): boolean {
    if (originalCount !== rotatedData.length) {
      return false
    }

    // Try to decrypt a few samples to verify
    const sampleSize = Math.min(3, rotatedData.length)
    for (let i = 0; i < sampleSize; i++) {
      try {
        CommentsCrypto.decrypt(rotatedData[i], context)
      } catch (error) {
        console.error('Key rotation verification failed:', error)
        return false
      }
    }

    return true
  }
}

// Export utility functions
export const generateEncryptionKey = CommentsCrypto.generateEncryptionKey
export const validateEncryptionKey = CommentsCrypto.validateEncryptionKey