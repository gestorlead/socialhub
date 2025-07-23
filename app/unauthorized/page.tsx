"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center">
          <AlertTriangle className="h-24 w-24 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Access Denied
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
            You don't have the required permissions to access this resource.
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={() => router.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
          
          <Button 
            onClick={() => router.push('/')}
            className="w-full sm:w-auto ml-0 sm:ml-2"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}