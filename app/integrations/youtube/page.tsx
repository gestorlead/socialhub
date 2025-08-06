'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { SuperAdminGuard } from '@/components/role-guard'
import { YouTubeIntegrationForm } from '@/components/admin/YouTubeIntegrationForm'
import { PlayCircle } from 'lucide-react'

export default function YouTubeIntegrationPage() {
  return (
    <DashboardLayout>
      <SuperAdminGuard>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <PlayCircle className="w-6 h-6 text-red-600" />
                Integração YouTube
              </h1>
              <p className="text-muted-foreground">
                Configure as credenciais e parâmetros da integração com o YouTube Data API
              </p>
            </div>
          </div>

          {/* Main Configuration Form */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Configurações da Integração</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure as credenciais da API do YouTube e ambiente de operação
              </p>
            </div>
            <div className="p-6">
              <YouTubeIntegrationForm />
            </div>
          </div>

          {/* API Information */}
          <div className="rounded-lg border bg-card">
            <div className="p-6 border-b">
              <h3 className="font-semibold">Informações da API</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">YouTube Data API v3</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Permite gerenciar canais, vídeos, playlists e obter analytics detalhados
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">YouTube Analytics API</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Acesso a métricas avançadas de performance, audiência e receita
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                  ⚠️ Requisitos Importantes
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• OAuth 2.0 consent screen configurado e verificado</li>
                  <li>• Projeto Google Cloud com YouTube Data API v3 habilitada</li>
                  <li>• Credenciais OAuth 2.0 para aplicação web</li>
                  <li>• Canal do YouTube associado à conta Google</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Documentation Links */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Documentação e Links Úteis</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://developers.google.com/youtube/v3/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📚 YouTube Data API - Getting Started
              </a>
              <a
                href="https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                🔐 OAuth 2.0 Authentication
              </a>
              <a
                href="https://developers.google.com/youtube/analytics/v2/available_reports"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📊 YouTube Analytics Reports
              </a>
              <a
                href="https://developers.google.com/youtube/v3/guides/uploading_a_video"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📹 Video Upload Guide
              </a>
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ⚙️ Enable YouTube Data API
              </a>
              <a
                href="https://developers.google.com/youtube/v3/docs/channels/list"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📋 Channel API Reference
              </a>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Instruções de Configuração</h3>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ol className="space-y-3">
                <li>
                  <strong>Crie um projeto no Google Cloud Console:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• Acesse console.cloud.google.com</li>
                    <li>• Crie um novo projeto ou selecione um existente</li>
                  </ul>
                </li>
                <li>
                  <strong>Habilite a YouTube Data API v3:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• Vá para APIs &amp; Services &gt; Library</li>
                    <li>• Procure por "YouTube Data API v3" e ative</li>
                  </ul>
                </li>
                <li>
                  <strong>Configure o OAuth consent screen:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• Defina o tipo de aplicação (Externa para testes)</li>
                    <li>• Preencha as informações obrigatórias do app</li>
                    <li>• Adicione os escopos necessários do YouTube</li>
                  </ul>
                </li>
                <li>
                  <strong>Crie credenciais OAuth 2.0:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• Vá para APIs &amp; Services &gt; Credentials</li>
                    <li>• Crie "OAuth 2.0 Client ID" para aplicação web</li>
                    <li>• Configure as URLs de redirect autorizadas</li>
                  </ul>
                </li>
                <li>
                  <strong>Configure os parâmetros abaixo:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• Client ID: Obtenha das credenciais OAuth 2.0</li>
                    <li>• Client Secret: Obtenha das credenciais OAuth 2.0</li>
                    <li>• Callback URL: Configure no formato correto</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </SuperAdminGuard>
    </DashboardLayout>
  )
}