'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { SuperAdminGuard } from '@/components/role-guard'
import { XIntegrationForm } from '@/components/admin/XIntegrationForm'
import { Settings } from 'lucide-react'

export default function XIntegrationPage() {
  return (
    <DashboardLayout>
      <SuperAdminGuard>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Integração X (Twitter)
              </h1>
              <p className="text-muted-foreground">
                Configure as credenciais e parâmetros da integração com o X
              </p>
            </div>
          </div>

          {/* Main Configuration Form */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Configurações da Integração</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure as credenciais do app X e o ambiente de operação (Free Tier)
              </p>
            </div>
            <div className="p-6">
              <XIntegrationForm />
            </div>
          </div>

          {/* Free Tier Information */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Limites do Free Tier</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                <div>
                  <p className="font-medium">100 posts/mês</p>
                  <p className="text-xs text-muted-foreground">Limite mensal de publicações</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="font-medium">1 Projeto</p>
                  <p className="text-xs text-muted-foreground">1 App por projeto</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <p className="font-medium">API v2</p>
                  <p className="text-xs text-muted-foreground">Acesso completo à v2</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documentation Links */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Documentação e Links Úteis</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://developer.x.com/en/portal/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🚀 Developer Portal
              </a>
              <a
                href="https://docs.x.com/x-api/getting-started/getting-access"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📚 Getting Started Guide
              </a>
              <a
                href="https://docs.x.com/fundamentals/authentication/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🔑 Authentication Docs
              </a>
              <a
                href="https://docs.x.com/x-api/rate-limits"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ⏱️ Rate Limits
              </a>
              <a
                href="https://docs.x.com/x-api/v2/tweets"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📝 Tweets API v2
              </a>
              <a
                href="https://github.com/PLhery/node-twitter-api-v2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📦 Recommended SDK
              </a>
            </div>
          </div>
        </div>
      </SuperAdminGuard>
    </DashboardLayout>
  )
}