/**
 * Test script for the enhanced cleanup system
 * Tests both local file and Supabase Storage cleanup
 */

// Use native fetch (Node.js 18+)

const BASE_URL = 'http://localhost:3000'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testEnhancedCleanup() {
  console.log('🧪 Testing Enhanced Cleanup System\n')
  
  // Test data
  const testJobId = 'test-job-' + Date.now()
  const testUserId = '12345678-1234-1234-1234-123456789012'
  
  // Mixed file paths (storage and local)
  const testFilePaths = [
    '/uploads/user123_1234567890_abcdef12.mp4',                    // Local file
    'media-uploads/uploads/user123_1234567891_bcdef123.jpg',       // Storage file (path format)
    'https://example.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_1234567892_cdef1234.png', // Storage URL format
    '/uploads/user123_1234567893_def12345.txt',                    // Another local file
    'uploads/user123_1234567894_ef123456.gif'                      // Ambiguous path
  ]
  
  console.log(`📂 Testing cleanup for ${testFilePaths.length} files:`)
  testFilePaths.forEach((path, index) => {
    console.log(`   ${index + 1}. ${path}`)
  })
  console.log()
  
  try {
    // Call enhanced cleanup API
    const response = await fetch(`${BASE_URL}/api/internal/cleanup-files/storage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        job_id: testJobId,
        user_id: testUserId,
        file_paths: testFilePaths
      })
    })
    
    const result = await response.json()
    
    console.log(`📋 Cleanup Response (${response.status}):`)
    console.log(JSON.stringify(result, null, 2))
    console.log()
    
    if (result.success) {
      console.log('✅ Enhanced cleanup test completed successfully!')
      console.log(`   - Files processed: ${result.results.summary.total}`)
      console.log(`   - Files deleted: ${result.results.summary.deleted}`)
      console.log(`   - Errors: ${result.results.summary.errors}`)
      
      if (result.results.deleted.length > 0) {
        console.log('\n📋 Deleted files:')
        result.results.deleted.forEach(file => {
          console.log(`   - ${file.path} (${file.type})`)
        })
      }
      
      if (result.results.errors.length > 0) {
        console.log('\n⚠️  Errors:')
        result.results.errors.forEach(error => {
          console.log(`   - ${error.path}: ${error.error}`)
        })
      }
      
    } else {
      console.log('❌ Enhanced cleanup test failed:')
      console.log(`   Error: ${result.error}`)
      if (result.details) {
        console.log(`   Details: ${result.details}`)
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message)
  }
}

// Test different cleanup scenarios
async function testCleanupScenarios() {
  console.log('\n🧪 Testing Different Cleanup Scenarios\n')
  
  const scenarios = [
    {
      name: 'Only Storage Files',
      files: [
        'media-uploads/uploads/storage_only_1.mp4',
        'media-uploads/uploads/storage_only_2.jpg'
      ]
    },
    {
      name: 'Only Local Files', 
      files: [
        '/uploads/local_only_1.mp4',
        '/uploads/local_only_2.jpg'
      ]
    },
    {
      name: 'Mixed Files',
      files: [
        '/uploads/mixed_local.mp4',
        'media-uploads/uploads/mixed_storage.jpg',
        'uploads/ambiguous_path.png'
      ]
    },
    {
      name: 'Invalid Files',
      files: [
        '/invalid/path/outside/uploads.txt',
        'nonexistent/file.mp4'
      ]
    }
  ]
  
  for (const scenario of scenarios) {
    console.log(`📁 Testing: ${scenario.name}`)
    
    try {
      const response = await fetch(`${BASE_URL}/api/internal/cleanup-files/storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          job_id: `test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          user_id: '12345678-1234-1234-1234-123456789012',
          file_paths: scenario.files
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`   ✅ Success: ${result.results.summary.deleted} deleted, ${result.results.summary.errors} errors`)
      } else {
        console.log(`   ❌ Failed: ${result.error}`)
      }
      
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`)
    }
    
    console.log()
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Enhanced Cleanup System Tests\n')
  console.log('=' .repeat(60))
  
  await testEnhancedCleanup()
  
  console.log('\n' + '=' .repeat(60))
  
  await testCleanupScenarios()
  
  console.log('🏁 All tests completed!')
}

// Check if running directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = {
  testEnhancedCleanup,
  testCleanupScenarios,
  runTests
}