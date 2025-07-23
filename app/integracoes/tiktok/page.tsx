'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { SuperAdminGuard } from '@/components/role-guard'
import { TikTokIntegrationForm } from '@/components/admin/TikTokIntegrationForm'
import { Settings, AlertTriangle } from 'lucide-react'

export default function TikTokIntegrationPage() {
  return (
    <DashboardLayout>
      <SuperAdminGuard>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Integração TikTok
              </h1>
              <p className="text-muted-foreground">
                Configure as credenciais e parâmetros da integração com o TikTok
              </p>
            </div>
          </div>


          {/* Environment Notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Sobre os Modos de Ambiente
                </h3>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p><strong>Sandbox:</strong> Para desenvolvimento e testes. Requer contas TikTok privadas.</p>
                  <p><strong>Produção:</strong> Para uso real. Requer app auditado pelo TikTok.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Configuration Form */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Configurações da Integração</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure as credenciais do app TikTok e o ambiente de operação
              </p>
            </div>
            <div className="p-6">
              <TikTokIntegrationForm />
            </div>
          </div>

          {/* Documentation Links */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Documentação e Links Úteis</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://developers.tiktok.com/doc/content-posting-api-get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📚 TikTok Content Posting API
              </a>
              <a
                href="https://developers.tiktok.com/doc/content-sharing-guidelines/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📋 Integration Guidelines
              </a>
              <a
                href="https://developers.tiktok.com/blog/introducing-sandbox"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🧪 Sandbox Documentation
              </a>
              <a
                href="https://developers.tiktok.com/doc/oauth-user-access-token-management"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🔑 OAuth Token Management
              </a>
            </div>
          </div>
        </div>
      </SuperAdminGuard>
    </DashboardLayout>
  )
}