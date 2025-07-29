'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { SuperAdminGuard } from '@/components/role-guard'
import { InstagramIntegrationForm } from '@/components/admin/InstagramIntegrationForm'
import { Instagram } from 'lucide-react'

export default function InstagramIntegrationPage() {
  return (
    <DashboardLayout>
      <SuperAdminGuard>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Instagram className="w-6 h-6" />
                Instagram Integration
              </h1>
              <p className="text-muted-foreground">
                Configure credentials and parameters for Instagram integration
              </p>
            </div>
          </div>

          {/* Main Configuration Form */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Integration Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Instagram Business Account credentials and operation environment
              </p>
            </div>
            <div className="p-6">
              <InstagramIntegrationForm />
            </div>
          </div>

          {/* Documentation Links */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Documentation and Useful Links</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://developers.facebook.com/docs/instagram-api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📚 Instagram Graph API
              </a>
              <a
                href="https://developers.facebook.com/docs/instagram-api/guides/content-publishing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📋 Content Publishing Guide
              </a>
              <a
                href="https://developers.facebook.com/docs/instagram-api/guides/business-discovery"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🔍 Business Discovery
              </a>
              <a
                href="https://developers.facebook.com/docs/instagram-api/reference/ig-user"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                👤 User Reference
              </a>
            </div>
          </div>
        </div>
      </SuperAdminGuard>
    </DashboardLayout>
  )
}