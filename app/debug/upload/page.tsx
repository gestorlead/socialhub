import { UploadLimitTest } from '@/components/debug/UploadLimitTest'

export default function UploadDebugPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Upload Diagnostics</h1>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="prose dark:prose-invert">
          <p>
            Use this page to diagnose upload limitations and identify the maximum
            file size your server can handle.
          </p>
          <p>
            The test will progressively send larger files to find the exact limit
            where 413 errors occur.
          </p>
        </div>
        
        <UploadLimitTest />
        
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Current Upload Settings:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Chunk Size: 1MB (down from 4MB)</li>
            <li>• Large File Threshold: 5MB</li>
            <li>• Files &gt;5MB use chunked upload</li>
            <li>• Files &lt;5MB use regular upload</li>
          </ul>
        </div>
      </div>
    </div>
  )
}