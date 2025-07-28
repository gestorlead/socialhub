#!/usr/bin/env node
/**
 * Crypto Testing Script
 * Tests encryption/decryption functionality and validates security
 */

const path = require('path')
const { performance } = require('perf_hooks')

// Set up module resolution
const projectRoot = path.resolve(__dirname, '..')
require('module')._initPaths()

// Add TypeScript support for importing .ts files
const ts = require('ts-node')
if (!process.env.TS_NODE_TRANSPILE_ONLY) {
  ts.register({
    project: path.join(projectRoot, 'tsconfig.json'),
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs'
    }
  })
}

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message) {
  console.log()
  log('bold', '='.repeat(60))
  log('cyan', `  ${message}`)
  log('bold', '='.repeat(60))
  console.log()
}

/**
 * Test data for encryption/decryption
 */
const testData = [
  'simple-test-string',
  'API_KEY_123456789',
  'very-long-secret-that-might-cause-issues-if-not-handled-properly-' + 'x'.repeat(100),
  'special!@#$%^&*()_+chars',
  'Unicode test: 🔐🔑🛡️',
  '',
  'single',
  JSON.stringify({ apiKey: 'test-key', secret: 'test-secret' }),
]

/**
 * Runs a single test case
 */
async function runTestCase(testName, testFunction) {
  try {
    log('blue', `🧪 Testing: ${testName}`)
    const startTime = performance.now()
    const result = await testFunction()
    const endTime = performance.now()
    const duration = (endTime - startTime).toFixed(2)
    
    if (result) {
      log('green', `✅ ${testName} - PASSED (${duration}ms)`)
      return true
    } else {
      log('red', `❌ ${testName} - FAILED (${duration}ms)`)
      return false
    }
  } catch (error) {
    log('red', `❌ ${testName} - ERROR: ${error.message}`)
    return false
  }
}

/**
 * Test basic encryption/decryption functionality
 */
async function testBasicEncryption() {
  try {
    // Import crypto module
    const crypto = require('../lib/crypto')
    
    for (const testString of testData) {
      // Skip empty string test for basic encryption
      if (testString === '') continue
      
      // Encrypt
      const encrypted = crypto.encrypt(testString)
      
      // Validate encrypted format
      if (!crypto.isEncrypted(encrypted)) {
        log('red', `  Failed: ${testString} - not detected as encrypted`)
        return false
      }
      
      // Decrypt
      const decrypted = crypto.decrypt(encrypted)
      
      // Validate decryption
      if (decrypted !== testString) {
        log('red', `  Failed: ${testString}`)
        log('red', `    Expected: ${testString}`)
        log('red', `    Got: ${decrypted}`)
        return false
      }
      
      log('cyan', `  ✓ ${testString.substring(0, 50)}${testString.length > 50 ? '...' : ''}`)
    }
    
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Test empty string handling
 */
async function testEmptyStringHandling() {
  try {
    const crypto = require('../lib/crypto')
    
    // Test empty string
    const encrypted = crypto.encrypt('')
    if (encrypted !== '') {
      log('red', `Empty string should return empty string, got: ${encrypted}`)
      return false
    }
    
    const decrypted = crypto.decrypt('')
    if (decrypted !== '') {
      log('red', `Empty encrypted string should return empty string, got: ${decrypted}`)
      return false
    }
    
    log('cyan', '  ✓ Empty string handling')
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Test encryption randomness (same input should produce different outputs)
 */
async function testEncryptionRandomness() {
  try {
    const crypto = require('../lib/crypto')
    const testString = 'randomness-test-string'
    
    const encrypted1 = crypto.encrypt(testString)
    const encrypted2 = crypto.encrypt(testString)
    
    if (encrypted1 === encrypted2) {
      log('red', 'Encryption should be random (different outputs for same input)')
      return false
    }
    
    // Both should decrypt to the same value
    const decrypted1 = crypto.decrypt(encrypted1)
    const decrypted2 = crypto.decrypt(encrypted2)
    
    if (decrypted1 !== testString || decrypted2 !== testString) {
      log('red', 'Decryption failed for randomness test')
      return false
    }
    
    log('cyan', '  ✓ Encryption produces different outputs for same input')
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Test encryption validation
 */
async function testEncryptionValidation() {
  try {
    const crypto = require('../lib/crypto')
    
    // Test valid encryption detection
    const encrypted = crypto.encrypt('test')
    if (!crypto.isEncrypted(encrypted)) {
      log('red', 'Valid encrypted string not detected as encrypted')
      return false
    }
    
    // Test invalid inputs
    const invalidInputs = [
      'not-encrypted',
      'definitely-not-base64!@#',
      Buffer.from('invalid:format').toString('base64'),
      ''
    ]
    
    for (const invalid of invalidInputs) {
      if (crypto.isEncrypted(invalid)) {
        log('red', `Invalid input detected as encrypted: ${invalid}`)
        return false
      }
    }
    
    log('cyan', '  ✓ Encryption validation works correctly')
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Test environment variable validation
 */
async function testEnvironmentValidation() {
  try {
    const crypto = require('../lib/crypto')
    
    // This will throw if INTEGRATION_ENCRYPTION_KEY is not properly set
    crypto.validateEncryptionSetup()
    
    log('cyan', '  ✓ Environment validation passed')
    return true
  } catch (error) {
    log('red', `Environment validation failed: ${error.message}`)
    return false
  }
}

/**
 * Test legacy format compatibility
 */
async function testLegacyCompatibility() {
  try {
    const crypto = require('../lib/crypto')
    
    // Create a legacy format encrypted string (salt:data in base64)
    const testData = 'legacy-test-data'
    const salt = 'abcd1234'
    const combined = salt + ':' + testData
    const legacyEncrypted = Buffer.from(combined).toString('base64')
    
    // Should be detected as encrypted
    if (!crypto.isEncrypted(legacyEncrypted)) {
      log('red', 'Legacy format not detected as encrypted')
      return false
    }
    
    // Should decrypt correctly
    const decrypted = crypto.decrypt(legacyEncrypted)
    if (decrypted !== testData) {
      log('red', `Legacy decryption failed. Expected: ${testData}, Got: ${decrypted}`)
      return false
    }
    
    log('cyan', '  ✓ Legacy format compatibility works')
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Performance test
 */
async function testPerformance() {
  try {
    const crypto = require('../lib/crypto')
    const testString = 'performance-test-string-' + 'x'.repeat(1000)
    const iterations = 100
    
    // Encryption performance
    const encryptStart = performance.now()
    const encrypted = []
    for (let i = 0; i < iterations; i++) {
      encrypted.push(crypto.encrypt(testString))
    }
    const encryptEnd = performance.now()
    const encryptTime = encryptEnd - encryptStart
    
    // Decryption performance
    const decryptStart = performance.now()
    for (let i = 0; i < iterations; i++) {
      crypto.decrypt(encrypted[i])
    }
    const decryptEnd = performance.now()
    const decryptTime = decryptEnd - decryptStart
    
    const avgEncryptTime = (encryptTime / iterations).toFixed(2)
    const avgDecryptTime = (decryptTime / iterations).toFixed(2)
    
    log('cyan', `  ✓ Encryption: ${avgEncryptTime}ms avg (${iterations} iterations)`)
    log('cyan', `  ✓ Decryption: ${avgDecryptTime}ms avg (${iterations} iterations)`)
    
    // Performance should be reasonable (less than 10ms per operation)
    if (parseFloat(avgEncryptTime) > 10 || parseFloat(avgDecryptTime) > 10) {
      log('yellow', '  ⚠️  Performance warning: operations taking longer than expected')
    }
    
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Security tests
 */
async function testSecurity() {
  try {
    const crypto = require('../lib/crypto')
    
    // Test that different encryptions of same data produce different results
    const testString = 'security-test'
    const results = new Set()
    
    for (let i = 0; i < 10; i++) {
      results.add(crypto.encrypt(testString))
    }
    
    if (results.size !== 10) {
      log('red', 'Security issue: encryption is not sufficiently random')
      return false
    }
    
    // Test that tampering with encrypted data causes decryption to fail
    const encrypted = crypto.encrypt(testString)
    const tampered = encrypted.slice(0, -5) + 'xxxxx'
    
    try {
      crypto.decrypt(tampered)
      log('red', 'Security issue: tampered data was successfully decrypted')
      return false
    } catch (error) {
      // This is expected - tampered data should fail to decrypt
      log('cyan', '  ✓ Tampered data properly rejected')
    }
    
    log('cyan', '  ✓ Security tests passed')
    return true
  } catch (error) {
    log('red', `Test failed: ${error.message}`)
    return false
  }
}

/**
 * Main test function
 */
async function main() {
  logHeader('Social Hub Crypto Testing Suite')
  
  // Check if encryption key is set
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    log('red', '❌ INTEGRATION_ENCRYPTION_KEY environment variable not set')
    log('yellow', '💡 Run: npm run generate-keys to generate a secure key')
    process.exit(1)
  }
  
  const tests = [
    ['Environment Validation', testEnvironmentValidation],
    ['Basic Encryption/Decryption', testBasicEncryption],
    ['Empty String Handling', testEmptyStringHandling],
    ['Encryption Randomness', testEncryptionRandomness],
    ['Encryption Validation', testEncryptionValidation],
    ['Legacy Format Compatibility', testLegacyCompatibility],
    ['Performance', testPerformance],
    ['Security', testSecurity]
  ]
  
  let passed = 0
  let failed = 0
  
  for (const [testName, testFunction] of tests) {
    const result = await runTestCase(testName, testFunction)
    if (result) {
      passed++
    } else {
      failed++
    }
  }
  
  logHeader('Test Results')
  log('green', `✅ Passed: ${passed}`)
  if (failed > 0) {
    log('red', `❌ Failed: ${failed}`)
  }
  log('cyan', `📊 Total: ${passed + failed}`)
  
  if (failed === 0) {
    log('green', '🎉 All tests passed! Crypto implementation is working correctly.')
  } else {
    log('red', '💥 Some tests failed. Please check the implementation.')
    process.exit(1)
  }
}

// Run the tests
if (require.main === module) {
  main().catch(error => {
    console.error('Test suite failed:', error)
    process.exit(1)
  })
}