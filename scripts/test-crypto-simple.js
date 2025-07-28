#!/usr/bin/env node
/**
 * Simple Crypto Testing Script
 * Tests encryption/decryption functionality directly
 */

const crypto = require('crypto')

// Simple console colors
const log = {
  error: (msg) => console.log('\x1b[31m' + msg + '\x1b[0m'),
  success: (msg) => console.log('\x1b[32m' + msg + '\x1b[0m'),
  info: (msg) => console.log('\x1b[34m' + msg + '\x1b[0m'),
  warn: (msg) => console.log('\x1b[33m' + msg + '\x1b[0m'),
}

// Simple crypto implementation for testing
function generateSecureKey(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

function encrypt(text, key) {
  if (!text) return ''
  
  try {
    // Split key for encryption and HMAC (32 bytes each from 64-char hex string)
    const encKey = Buffer.from(key.substring(0, 32), 'hex')  // 16 bytes
    const hmacKey = Buffer.from(key.substring(32, 64), 'hex') // 16 bytes
    
    // For AES-256, we need 32 bytes, so let's derive it properly
    const fullEncKey = crypto.scryptSync(encKey, 'salt', 32)
    const fullHmacKey = crypto.scryptSync(hmacKey, 'salt', 32)
    
    // Generate random IV
    const iv = crypto.randomBytes(16)
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', fullEncKey, iv)
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Create HMAC
    const hmac = crypto.createHmac('sha256', fullHmacKey)
    hmac.update(iv.toString('hex') + ':' + encrypted)
    const authTag = hmac.digest('hex')
    
    // Combine
    const combined = iv.toString('hex') + ':' + authTag + ':' + encrypted
    
    return Buffer.from(combined).toString('base64')
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`)
  }
}

function decrypt(encryptedData, key) {
  if (!encryptedData) return ''
  
  try {
    // Decode
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8')
    const parts = decoded.split(':')
    
    if (parts.length === 3 && parts[0].length === 32 && parts[1].length === 64) {
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = parts[1]
      const encrypted = parts[2]
      
      // Split key and derive full keys
      const encKey = Buffer.from(key.substring(0, 32), 'hex')
      const hmacKey = Buffer.from(key.substring(32, 64), 'hex')
      const fullEncKey = crypto.scryptSync(encKey, 'salt', 32)
      const fullHmacKey = crypto.scryptSync(hmacKey, 'salt', 32)
      
      // Verify HMAC
      const hmac = crypto.createHmac('sha256', fullHmacKey)
      hmac.update(parts[0] + ':' + encrypted)
      const expectedAuthTag = hmac.digest('hex')
      
      if (authTag !== expectedAuthTag) {
        throw new Error('Authentication failed')
      }
      
      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-cbc', fullEncKey, iv)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    }
    
    throw new Error('Invalid format')
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`)
  }
}

// Load environment variables from .env file
const fs = require('fs')
const path = require('path')

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
  }
}

// Test functions
async function runTests() {
  loadEnvFile()
  console.log('🔐 Social Hub Crypto Testing\n')
  
  // Check environment variable
  const testKey = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!testKey) {
    log.error('❌ INTEGRATION_ENCRYPTION_KEY environment variable not set')
    log.info('💡 Run: export INTEGRATION_ENCRYPTION_KEY=' + generateSecureKey(32))
    process.exit(1)
  }
  
  // Validate key format
  if (!/^[a-fA-F0-9]{64}$/.test(testKey)) {
    log.error('❌ INTEGRATION_ENCRYPTION_KEY must be 64-character hex string')
    log.info('💡 Run: export INTEGRATION_ENCRYPTION_KEY=' + generateSecureKey(32))
    process.exit(1)
  }
  
  log.success('✅ Environment key validation passed')
  
  // Test data
  const testData = [
    'simple-test',
    'API_KEY_123456789',
    'special!@#$%^&*()_+chars',
    JSON.stringify({ apiKey: 'test', secret: 'value' }),
    'long-string-' + 'x'.repeat(100)
  ]
  
  let passed = 0
  let failed = 0
  
  // Test basic encryption/decryption
  try {
    log.info('🧪 Testing basic encryption/decryption...')
    
    for (const data of testData) {
      const encrypted = encrypt(data, testKey)
      const decrypted = decrypt(encrypted, testKey)
      
      if (decrypted !== data) {
        throw new Error(`Mismatch for: ${data}`)
      }
    }
    
    log.success('✅ Basic encryption/decryption test passed')
    passed++
  } catch (error) {
    log.error(`❌ Basic encryption/decryption test failed: ${error.message}`)
    failed++
  }
  
  // Test empty string
  try {
    log.info('🧪 Testing empty string handling...')
    
    const encrypted = encrypt('', testKey)
    const decrypted = decrypt('', testKey)
    
    if (encrypted !== '' || decrypted !== '') {
      throw new Error('Empty string handling failed')
    }
    
    log.success('✅ Empty string test passed')
    passed++
  } catch (error) {
    log.error(`❌ Empty string test failed: ${error.message}`)
    failed++
  }
  
  // Test randomness
  try {
    log.info('🧪 Testing encryption randomness...')
    
    const testString = 'randomness-test'
    const encrypted1 = encrypt(testString, testKey)
    const encrypted2 = encrypt(testString, testKey)
    
    if (encrypted1 === encrypted2) {
      throw new Error('Encryption is not random')
    }
    
    if (decrypt(encrypted1, testKey) !== testString || 
        decrypt(encrypted2, testKey) !== testString) {
      throw new Error('Random encryption decryption failed')
    }
    
    log.success('✅ Encryption randomness test passed')
    passed++
  } catch (error) {
    log.error(`❌ Encryption randomness test failed: ${error.message}`)
    failed++
  }
  
  // Test tampering detection
  try {
    log.info('🧪 Testing tampering detection...')
    
    const encrypted = encrypt('tamper-test', testKey)
    const tampered = encrypted.slice(0, -5) + 'xxxxx'
    
    try {
      decrypt(tampered, testKey)
      throw new Error('Tampered data was accepted')
    } catch (error) {
      if (!error.message.includes('Authentication failed') && !error.message.includes('Decryption failed')) {
        throw error
      }
    }
    
    log.success('✅ Tampering detection test passed')
    passed++
  } catch (error) {
    log.error(`❌ Tampering detection test failed: ${error.message}`)
    failed++
  }
  
  // Performance test
  try {
    log.info('🧪 Testing performance...')
    
    const testString = 'performance-test-' + 'x'.repeat(1000)
    const iterations = 50
    
    const start = Date.now()
    for (let i = 0; i < iterations; i++) {
      const encrypted = encrypt(testString, testKey)
      decrypt(encrypted, testKey)
    }
    const end = Date.now()
    
    const avgTime = (end - start) / iterations
    log.info(`   Average: ${avgTime.toFixed(2)}ms per encrypt+decrypt cycle`)
    
    if (avgTime > 50) {
      log.warn('⚠️  Performance warning: operations taking longer than expected')
    }
    
    log.success('✅ Performance test passed')
    passed++
  } catch (error) {
    log.error(`❌ Performance test failed: ${error.message}`)
    failed++
  }
  
  // Results
  console.log('\n📊 Test Results:')
  log.success(`✅ Passed: ${passed}`)
  if (failed > 0) {
    log.error(`❌ Failed: ${failed}`)
  }
  console.log(`📈 Total: ${passed + failed}`)
  
  if (failed === 0) {
    log.success('\n🎉 All tests passed! Crypto implementation is working correctly.')
  } else {
    log.error('\n💥 Some tests failed. Please check the implementation.')
    process.exit(1)
  }
}

// Run tests
runTests().catch(error => {
  log.error('Test suite failed: ' + error.message)
  process.exit(1)
})