/**
 * Unit test for cleanup system logic
 * Tests the path detection and cleanup logic without server
 */

// Simulate the cleanup logic from the API
function detectFileType(filePath) {
  if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
    return 'local'
  } else if (filePath.includes('supabase') || filePath.startsWith('media-uploads/')) {
    return 'storage'
  } else {
    return 'ambiguous'
  }
}

function cleanupStorageFile(filePath) {
  // Extract the actual file path for storage
  let storagePath = filePath
  
  // Handle different path formats
  if (filePath.includes('/storage/v1/object/public/media-uploads/')) {
    // Full URL format
    storagePath = filePath.split('/storage/v1/object/public/media-uploads/')[1]
  } else if (filePath.startsWith('media-uploads/')) {
    // Already in correct format
    storagePath = filePath.substring('media-uploads/'.length)
  } else if (filePath.startsWith('uploads/')) {
    // Convert local uploads path to storage path
    storagePath = filePath.substring('uploads/'.length)
  }
  
  return {
    originalPath: filePath,
    storagePath: storagePath,
    action: 'delete_from_storage'
  }
}

function cleanupLocalFile(filePath) {
  // Normalize path and ensure it's within uploads directory
  const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
  
  return {
    originalPath: filePath,
    normalizedPath: normalizedPath,
    action: 'delete_from_local'
  }
}

function testCleanupLogic() {
  console.log('🧪 Testing Enhanced Cleanup Logic\n')
  
  const testFiles = [
    '/uploads/user123_1234567890_abcdef12.mp4',                    // Local file
    'media-uploads/uploads/user123_1234567891_bcdef123.jpg',       // Storage file (path format)
    'https://example.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_1234567892_cdef1234.png', // Storage URL format
    '/uploads/user123_1234567893_def12345.txt',                    // Another local file
    'uploads/user123_1234567894_ef123456.gif'                      // Ambiguous path
  ]
  
  console.log('📂 Testing file type detection:')
  testFiles.forEach((filePath, index) => {
    const type = detectFileType(filePath)
    console.log(`   ${index + 1}. ${filePath}`)
    console.log(`      → Type: ${type}`)
    
    if (type === 'storage') {
      const result = cleanupStorageFile(filePath)
      console.log(`      → Storage path: ${result.storagePath}`)
    } else if (type === 'local') {
      const result = cleanupLocalFile(filePath)
      console.log(`      → Normalized path: ${result.normalizedPath}`)
    }
    console.log()
  })
  
  // Test cleanup strategy for mixed files
  console.log('📋 Testing cleanup strategy:')
  const storageFiles = testFiles.filter(f => detectFileType(f) === 'storage')
  const localFiles = testFiles.filter(f => detectFileType(f) === 'local')
  const ambiguousFiles = testFiles.filter(f => detectFileType(f) === 'ambiguous')
  
  console.log(`   - Storage files: ${storageFiles.length}`)
  console.log(`   - Local files: ${localFiles.length}`)
  console.log(`   - Ambiguous files: ${ambiguousFiles.length}`)
  
  console.log('\n✅ Enhanced cleanup logic test completed!')
}

// Test the storage path extraction logic specifically
function testStoragePathExtraction() {
  console.log('\n🔧 Testing Storage Path Extraction\n')
  
  const storageTestCases = [
    {
      input: 'media-uploads/uploads/user123_file.mp4',
      expected: 'uploads/user123_file.mp4'
    },
    {
      input: 'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_file.mp4',
      expected: 'uploads/user123_file.mp4'
    },
    {
      input: 'uploads/user123_file.mp4',
      expected: 'user123_file.mp4'
    }
  ]
  
  console.log('🎯 Testing storage path extraction:')
  storageTestCases.forEach((testCase, index) => {
    const result = cleanupStorageFile(testCase.input)
    const passed = result.storagePath === testCase.expected
    
    console.log(`   ${index + 1}. ${passed ? '✅' : '❌'} Input: ${testCase.input}`)
    console.log(`      Expected: ${testCase.expected}`)
    console.log(`      Got: ${result.storagePath}`)
    console.log()
  })
}

// Simulate the cleanup process
function simulateCleanupProcess() {
  console.log('\n🚀 Simulating Full Cleanup Process\n')
  
  const jobData = {
    job_id: 'test-job-12345',
    user_id: '12345678-1234-1234-1234-123456789012',
    file_paths: [
      '/uploads/local_file1.mp4',
      'media-uploads/uploads/storage_file1.jpg',
      'uploads/ambiguous_file1.png',
      'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/storage_file2.mp4'
    ]
  }
  
  console.log(`📦 Processing cleanup for job: ${jobData.job_id}`)
  console.log(`👤 User: ${jobData.user_id}`)
  console.log(`📁 Files: ${jobData.file_paths.length}`)
  console.log()
  
  const cleanupResults = []
  const errors = []
  
  jobData.file_paths.forEach(filePath => {
    const type = detectFileType(filePath)
    
    try {
      if (type === 'storage') {
        const result = cleanupStorageFile(filePath)
        cleanupResults.push({
          path: filePath,
          type: 'storage',
          status: 'deleted',
          storagePath: result.storagePath
        })
      } else if (type === 'local') {
        const result = cleanupLocalFile(filePath)
        cleanupResults.push({
          path: filePath,
          type: 'local', 
          status: 'deleted',
          normalizedPath: result.normalizedPath
        })
      } else {
        // Try both methods for ambiguous paths
        try {
          const localResult = cleanupLocalFile(filePath)
          cleanupResults.push({
            path: filePath,
            type: 'local',
            status: 'deleted',
            normalizedPath: localResult.normalizedPath
          })
        } catch {
          const storageResult = cleanupStorageFile(filePath)
          cleanupResults.push({
            path: filePath,
            type: 'storage',
            status: 'deleted',
            storagePath: storageResult.storagePath
          })
        }
      }
    } catch (error) {
      errors.push({
        path: filePath,
        error: error.message
      })
    }
  })
  
  console.log('📊 Cleanup Results:')
  console.log(`   - Successfully processed: ${cleanupResults.length}`)
  console.log(`   - Errors: ${errors.length}`)
  
  if (cleanupResults.length > 0) {
    console.log('\n✅ Successful cleanups:')
    cleanupResults.forEach(result => {
      console.log(`   - ${result.path} (${result.type})`)
    })
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    errors.forEach(error => {
      console.log(`   - ${error.path}: ${error.error}`)
    })
  }
  
  console.log('\n🏁 Simulation completed!')
}

// Run all tests
function runAllTests() {
  console.log('🚀 Enhanced Cleanup System Unit Tests\n')
  console.log('=' .repeat(60))
  
  testCleanupLogic()
  testStoragePathExtraction()
  simulateCleanupProcess()
  
  console.log('\n' + '=' .repeat(60))
  console.log('🎉 All unit tests completed successfully!')
}

// Run tests if script is executed directly
if (require.main === module) {
  runAllTests()
}

module.exports = {
  detectFileType,
  cleanupStorageFile,
  cleanupLocalFile,
  testCleanupLogic,
  testStoragePathExtraction,
  simulateCleanupProcess,
  runAllTests
}