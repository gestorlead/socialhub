'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface TestResult {
  size: number
  sizeLabel: string
  success: boolean
  error?: string
  contentLength?: string
}

export function UploadLimitTest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const testSpecificSize = async (size: number) => {
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

  const runTest = async () => {
    setTesting(true)
    setResults([])
    
    const testSizes = [
      100 * 1024,        // 100KB
      500 * 1024,        // 500KB
      1024 * 1024,       // 1MB
      2 * 1024 * 1024,   // 2MB
      4 * 1024 * 1024,   // 4MB
      5 * 1024 * 1024,   // 5MB
      10 * 1024 * 1024,  // 10MB
    ]
    
    const newResults: TestResult[] = []
    
    console.log('🧪 Starting Upload Limit Test...')
    
    for (const size of testSizes) {
      const sizeLabel = formatSize(size)
      console.log(`[Upload Limit Test] Testing ${sizeLabel}...`)
      
      try {
        const result = await testSpecificSize(size)
        const testResult = {
          size,
          sizeLabel,
          success: true,
          contentLength: result.receivedContentLength
        }
        newResults.push(testResult)
        setResults([...newResults])
        console.log(`[Upload Limit Test] ✅ ${sizeLabel} - SUCCESS`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const testResult = {
          size,
          sizeLabel,
          success: false,
          error: errorMessage
        }
        newResults.push(testResult)
        setResults([...newResults])
        console.log(`[Upload Limit Test] ❌ ${sizeLabel} - FAILED: ${errorMessage}`)
        
        // If we hit a limit, stop testing larger sizes
        if (errorMessage.includes('413')) {
          console.log(`[Upload Limit Test] Hit 413 limit at ${sizeLabel}, stopping tests`)
          break
        }
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    setTesting(false)
    
    // Log summary
    const maxSuccessfulSize = Math.max(...newResults.filter(r => r.success).map(r => r.size))
    if (maxSuccessfulSize > 0) {
      console.log(`🎯 Maximum successful upload: ${formatSize(maxSuccessfulSize)}`)
      console.log(`💡 Recommended chunk size: ${formatSize(Math.floor(maxSuccessfulSize * 0.8))}`)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-4">🧪 Upload Limit Test</h3>
      
      <div className="mb-4">
        <Button 
          onClick={runTest} 
          disabled={testing}
          variant="outline"
        >
          {testing ? 'Testing...' : 'Run Upload Limit Test'}
        </Button>
      </div>
      
      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Test Results:</h4>
          {results.map((result, index) => (
            <div 
              key={index} 
              className={`flex items-center gap-2 text-sm p-2 rounded ${
                result.success 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              <span>{result.success ? '✅' : '❌'}</span>
              <span className="font-mono">{result.sizeLabel}</span>
              {result.contentLength && (
                <span className="text-xs opacity-75">({result.contentLength} bytes)</span>
              )}
              {result.error && (
                <span className="text-xs">- {result.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        <p>This test sends files of increasing sizes to identify your server's upload limit.</p>
        <p>Check the browser console for detailed logs.</p>
      </div>
    </div>
  )
}