/**
 * Utility to test server upload limits
 * Helps diagnose 413 errors by testing progressive sizes
 */

interface TestResult {
  size: number
  sizeLabel: string
  success: boolean
  error?: string
  contentLength?: string
}

/**
 * Test upload limit by sending progressively larger payloads
 */
export async function testUploadLimits(): Promise<TestResult[]> {
  const testSizes = [
    100 * 1024,        // 100KB
    500 * 1024,        // 500KB
    1024 * 1024,       // 1MB
    2 * 1024 * 1024,   // 2MB
    4 * 1024 * 1024,   // 4MB
    5 * 1024 * 1024,   // 5MB
    10 * 1024 * 1024,  // 10MB
  ]
  
  const results: TestResult[] = []
  
  console.log('[Upload Limit Test] Starting progressive size tests...')
  
  for (const size of testSizes) {
    const sizeLabel = formatSize(size)
    console.log(`[Upload Limit Test] Testing ${sizeLabel}...`)
    
    try {
      const result = await testSpecificSize(size)
      results.push({
        size,
        sizeLabel,
        success: true,
        contentLength: result.receivedContentLength
      })
      console.log(`[Upload Limit Test] ✅ ${sizeLabel} - SUCCESS`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        size,
        sizeLabel,
        success: false,
        error: errorMessage
      })
      console.log(`[Upload Limit Test] ❌ ${sizeLabel} - FAILED: ${errorMessage}`)
      
      // If we hit a limit, stop testing larger sizes
      if (errorMessage.includes('413')) {
        console.log(`[Upload Limit Test] Hit 413 limit at ${sizeLabel}, stopping tests`)
        break
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return results
}

/**
 * Test a specific upload size
 */
async function testSpecificSize(size: number) {
  // Create a test file of the specified size
  const testData = new Uint8Array(size)
  // Fill with some data pattern to avoid compression
  for (let i = 0; i < testData.length; i++) {
    testData[i] = i % 256
  }
  
  const testFile = new File([testData], `test-${formatSize(size)}.bin`, {
    type: 'application/octet-stream'
  })
  
  const formData = new FormData()
  formData.append('testFile', testFile)
  formData.append('testSize', formatSize(size))
  
  const response = await fetch('/api/test/upload-limit', {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return await response.json()
}

/**
 * Format byte size to human readable string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * Run upload limit test and log results to console
 */
export async function runUploadLimitTest(): Promise<void> {
  console.log('🧪 Starting Upload Limit Test...')
  
  try {
    const results = await testUploadLimits()
    
    console.log('\n📊 Upload Limit Test Results:')
    console.log('=' .repeat(50))
    
    let maxSuccessfulSize = 0
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      const error = result.error ? ` (${result.error})` : ''
      console.log(`${status} ${result.sizeLabel}${error}`)
      
      if (result.success && result.size > maxSuccessfulSize) {
        maxSuccessfulSize = result.size
      }
    })
    
    console.log('=' .repeat(50))
    
    if (maxSuccessfulSize > 0) {
      console.log(`🎯 Maximum successful upload: ${formatSize(maxSuccessfulSize)}`)
      console.log(`💡 Recommended chunk size: ${formatSize(Math.floor(maxSuccessfulSize * 0.8))}`)
    } else {
      console.log('❌ No successful uploads detected')
    }
    
  } catch (error) {
    console.error('🚨 Upload Limit Test failed:', error)
  }
}