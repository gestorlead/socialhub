"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, Info } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function InstagramPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectInstagram, getConnection, refresh, disconnect } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const instagramConnection = getConnection('instagram')
  const profile = instagramConnection?.profile_data
  
  // Function to format large numbers elegantly
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  const handleRefresh = async () => {
    if (!user) return
    
    setRefreshing(true)
    try {
      // Refresh profile data
      const response = await fetch(`/api/social/instagram/refresh?user_id=${user.id}`, {
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
      await connectInstagram()
    } catch (error: any) {
      setConnectError(error.message || 'Erro ao conectar Instagram')
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

  if (!isConnected('instagram')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Instagram</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do Instagram para gerenciar seu conteúdo
            </p>
          </div>

          {/* Professional Account Alert */}
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Importante:</strong> Para publicar conteúdo através da API, você precisa de uma conta Instagram Professional (Business ou Creator) conectada a uma Facebook Page.
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg flex items-center justify-center mx-auto">
                <img 
                  src="/images/social-icons/instagram.png" 
                  alt="Instagram" 
                  className="w-16 h-16 object-contain brightness-0 invert"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do Instagram</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta Professional do Instagram.
                </p>
                <button 
                  onClick={handleConnect}
                  className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md text-sm hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
                >
                  Conectar Instagram
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
            <h1 className="text-3xl font-bold tracking-tight">Instagram</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie sua conta do Instagram
              </p>
              {instagramConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(instagramConnection.updated_at).toLocaleDateString('pt-BR')}
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

        {/* Profile Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-lg text-white">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-1">
                  <Image 
                    src="/images/social-icons/instagram.png" 
                    alt="Instagram" 
                    width={48} 
                    height={48}
                    className="brightness-0 invert"
                  />
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    {profile?.username || 'Instagram User'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    @{profile?.username || 'username'}
                  </p>
                  {profile?.account_type && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Shield className="w-4 h-4 text-blue-300" />
                      <span className="text-xs text-blue-300">
                        {profile.account_type === 'BUSINESS' ? 'Business' : 'Creator'} Account
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      if (disconnecting) return
                      setDisconnecting(true)
                      try {
                        await disconnect('instagram')
                        // Redirect to dashboard after disconnect
                        window.location.href = '/'
                      } catch (error) {
                        alert('Erro ao desconectar conta. Tente novamente.')
                      } finally {
                        setDisconnecting(false)
                      }
                    }}
                    disabled={disconnecting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-200 border border-red-400/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    <Unlink className={`w-4 h-4 ${disconnecting ? 'animate-spin' : ''}`} />
                    {disconnecting ? 'Desconectando...' : 'Desconectar Conta'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span className="text-xs text-muted-foreground">Posts</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(profile?.media_count || 0)}</p>
              <p className="text-sm text-muted-foreground">Total de posts</p>
            </div>

            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <User className="w-5 h-5 text-purple-500" />
                <span className="text-xs text-muted-foreground">ID</span>
              </div>
              <p className="text-lg font-mono">{profile?.id || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Instagram User ID</p>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-card border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Informações da Conta
            </h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Instagram User ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.id || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Tipo de Conta</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Shield className="w-4 h-4" />
                {profile?.account_type === 'BUSINESS' ? 'Business' : profile?.account_type === 'CREATOR' ? 'Creator' : 'Professional'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {instagramConnection?.created_at 
                  ? new Date(instagramConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {instagramConnection?.updated_at 
                  ? new Date(instagramConnection.updated_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Token expira em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Clock className="w-4 h-4" />
                {instagramConnection?.expires_at 
                  ? new Date(instagramConnection.expires_at).toLocaleDateString('pt-BR')
                  : 'Nunca'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {instagramConnection?.is_active ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Ativo</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">Inativo</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Publishing Limits Info */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <strong>Limites de Publicação:</strong> O Instagram permite até 100 posts por período de 24 horas por conta. 
            Apenas imagens JPEG são suportadas. Vídeos e outros formatos devem ser convertidos antes da publicação.
          </AlertDescription>
        </Alert>

        {/* Available Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/publish"
              className="group p-4 border rounded-lg hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <Edit3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-medium">Publicar Fotos</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Publique fotos diretamente no Instagram com legendas personalizadas
              </p>
            </Link>
            
            <Link
              href="/analytics/instagram"
              className="group p-4 border rounded-lg hover:border-pink-200 dark:hover:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg group-hover:bg-pink-200 dark:group-hover:bg-pink-800 transition-colors">
                  <TrendingUp className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
                <h4 className="font-medium">Análise de Performance</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Veja métricas detalhadas e histórico de crescimento
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
                Programe suas fotos para publicação automática
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