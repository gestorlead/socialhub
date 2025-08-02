"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { FacebookStatCard } from "@/components/facebook-stat-card"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, Info, Users, ThumbsUp, MessageCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function FacebookPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectFacebook, getConnection, refresh, disconnect } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)

  const facebookConnection = getConnection('facebook')
  const profile = facebookConnection?.profile_data
  const pages = profile?.pages || []
  const selectedPageFromProfile = profile?.selected_page
  const selectedPageIdFromProfile = profile?.selected_page_id
  
  // Use selected page from profile, or redirect to selection if multiple pages
  useEffect(() => {
    if (pages.length > 1 && !selectedPageIdFromProfile) {
      // Redirect to page selection if multiple pages and none selected
      window.location.href = '/networks/facebook/select-page'
    } else if (pages.length === 1 && !selectedPageIdFromProfile) {
      // Auto-select single page
      const singlePage = pages[0]
      const updatedProfileData = {
        ...profile,
        selected_page_id: singlePage.id,
        selected_page: singlePage
      }
      
      // Save the auto-selection
      fetch('/api/social/facebook/select-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: singlePage.id,
          profile_data: updatedProfileData
        })
      }).then(() => {
        refresh()
      })
    }
  }, [pages, selectedPageIdFromProfile, profile])

  const selectedPage = selectedPageFromProfile || pages.find(page => page.id === selectedPageIdFromProfile)
  
  // Function to format large numbers elegantly
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 10000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  const handleRefresh = async () => {
    if (!user) return
    
    setRefreshing(true)
    try {
      // Refresh profile data
      const response = await fetch(`/api/social/facebook/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        await refresh()
      }
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnectError(null)
      await connectFacebook()
    } catch (error: any) {
      setConnectError(error.message || 'Erro ao conectar Facebook')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isConnected('facebook')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook</h1>
            <p className="text-muted-foreground">
              Conecte suas páginas do Facebook para gerenciar seu conteúdo
            </p>
          </div>

          {/* Professional Account Alert */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Importante:</strong> Apenas páginas do Facebook podem ser conectadas. Perfis pessoais não são suportados pela API do Facebook.
            </AlertDescription>
          </Alert>

          {connectError && (
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-300">
                {connectError}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-24 h-24 rounded-full bg-[#1877f2] shadow-lg flex items-center justify-center mx-auto">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                  className="object-contain"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte suas páginas do Facebook</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar suas páginas do Facebook.
                </p>
                <button 
                  onClick={handleConnect}
                  className="mt-3 w-full py-2 px-4 bg-[#1877f2] text-white rounded-md text-sm hover:bg-[#166fe5] transition-all duration-200"
                >
                  Conectar Facebook
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie suas páginas do Facebook
              </p>
              {facebookConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(facebookConnection.updated_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </button>
          </div>
        </div>

        {/* Current Page Info */}
        {selectedPage && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Página gerenciada:</strong> {selectedPage.name} - {selectedPage.category}
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-[#1877f2] p-6 rounded-lg text-white">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-1">
                  {selectedPage?.picture ? (
                    <img 
                      src={selectedPage.picture}
                      alt={`${selectedPage.name || 'Facebook'} Profile`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="white"
                      xmlns="http://www.w3.org/2000/svg"
                      className="object-contain"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )}
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    {selectedPage?.name || 'Facebook Page'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {selectedPage?.category || 'Page'}
                  </p>
                  {selectedPage?.is_published !== false && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Shield className="w-4 h-4 text-green-300" />
                      <span className="text-xs text-green-300">
                        Página Publicada
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      try {
                        await disconnect('facebook')
                        // Redirect to dashboard after disconnect
                        window.location.href = '/'
                      } catch (error) {
                        alert('Erro ao desconectar conta. Tente novamente.')
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-200 border border-red-400/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm mt-2"
                  >
                    <Unlink className="w-4 h-4" />
                    Desconectar Conta
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
            <FacebookStatCard
              icon={<ThumbsUp className="w-6 h-6 text-white" />}
              title="Curtidas"
              value={selectedPage?.fan_count || 0}
              colorClass="hover:border-blue-200 dark:hover:border-blue-800"
            />
            
            <FacebookStatCard
              icon={<Users className="w-6 h-6 text-white" />}
              title="Seguidores"
              value={selectedPage?.followers_count || 0}
              colorClass="hover:border-emerald-200 dark:hover:border-emerald-800"
            />
            
            <FacebookStatCard
              icon={<MessageCircle className="w-6 h-6 text-white" />}
              title="Engajamento"
              value={selectedPage?.engagement_count || 0}
              colorClass="hover:border-purple-200 dark:hover:border-purple-800"
            />

            <div className="bg-card border rounded-lg p-4 hover:border-[#1877f2] transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-[#1877f2] rounded-lg text-white">
                  <User className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-muted-foreground">Page ID</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-mono text-sm">{selectedPage?.id || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Facebook Page ID</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-card border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Informações da Página
            </h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Facebook Page ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {selectedPage?.id || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Categoria</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Shield className="w-4 h-4" />
                {selectedPage?.category || 'N/A'}
              </p>
            </div>

            {selectedPage?.about && (
              <div className="md:col-span-full">
                <p className="text-sm text-muted-foreground">Sobre</p>
                <p className="text-sm bg-muted px-2 py-1 rounded mt-1">
                  {selectedPage.about}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {facebookConnection?.created_at 
                  ? new Date(facebookConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {facebookConnection?.updated_at 
                  ? new Date(facebookConnection.updated_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status do Token</p>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Válido</span>
              </div>
            </div>
          </div>
        </div>

        {/* Publishing Limits Info */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <strong>Limites de Publicação:</strong> O Facebook permite até 50 posts agendados por página. 
            Suporta imagens, vídeos, links e posts de texto. Você pode agendar posts com até 6 meses de antecedência.
          </AlertDescription>
        </Alert>

        {/* Available Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/publish"
              className="group p-4 border rounded-lg hover:border-[#1877f2] hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <Edit3 className="w-4 h-4 text-[#1877f2]" />
                </div>
                <h4 className="font-medium">Publicar Conteúdo</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Publique posts, fotos e vídeos em suas páginas do Facebook
              </p>
            </Link>
            
            <Link
              href="/analytics/facebook"
              className="group p-4 border rounded-lg hover:border-[#1877f2] hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <TrendingUp className="w-4 h-4 text-[#1877f2]" />
                </div>
                <h4 className="font-medium">Análise de Performance</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Veja insights detalhados e métricas de engajamento
              </p>
            </Link>
            
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-500" />
                </div>
                <h4 className="font-medium">Agendar Posts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Agende seus posts para publicação automática
              </p>
              <span className="inline-block mt-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                Em breve
              </span>
            </div>
          </div>
        </div>


      </div>
    </DashboardLayout>
  )
}