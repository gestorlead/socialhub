'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { SuperAdminGuard } from '@/components/role-guard'
import { FacebookIntegrationForm } from '@/components/admin/FacebookIntegrationForm'
import { Facebook } from 'lucide-react'

export default function FacebookIntegrationPage() {
  return (
    <DashboardLayout>
      <SuperAdminGuard>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Facebook className="w-6 h-6" />
                Facebook Integration
              </h1>
              <p className="text-muted-foreground">
                Configure credentials and parameters for Facebook integration
              </p>
            </div>
          </div>

          {/* Main Configuration Form */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Integration Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Facebook Page credentials and operation environment
              </p>
            </div>
            <div className="p-6">
              <FacebookIntegrationForm />
            </div>
          </div>

          {/* Documentation Links */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Documentation and Useful Links</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://developers.facebook.com/docs/pages"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📚 Facebook Pages API
              </a>
              <a
                href="https://developers.facebook.com/docs/pages/publishing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📋 Publishing Guide
              </a>
              <a
                href="https://developers.facebook.com/docs/pages/access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🔑 Access Tokens
              </a>
              <a
                href="https://developers.facebook.com/docs/permissions/reference"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🛡️ Permissions Reference
              </a>
            </div>
          </div>
        </div>
      </SuperAdminGuard>
    </DashboardLayout>
  )
}