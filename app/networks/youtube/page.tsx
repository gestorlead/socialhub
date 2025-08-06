"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Play, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, PlayCircle, Users, Video } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function YouTubePage() {
  const { user, loading } = useAuth()
  const { isConnected, connectYouTube, getConnection, refresh, disconnect } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const youtubeConnection = getConnection('youtube')
  const profile = youtubeConnection?.profile_data
  
  // Use stored stats from profile
  const displayStats = profile ? {
    subscriber_count: profile.subscriber_count || 0,
    video_count: profile.video_count || 0,
    view_count: profile.view_count || 0,
    comment_count: profile.comment_count || 0
  } : null

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
      const response = await fetch(`/api/social/youtube/refresh?user_id=${user.id}`, {
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

  if (!isConnected('youtube')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">YouTube</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do YouTube para gerenciar seu conteúdo
            </p>
          </div>

          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mx-auto">
                <PlayCircle className="w-16 h-16 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do YouTube</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta do YouTube.
                </p>
                <button 
                  onClick={() => connectYouTube()}
                  className="mt-3 w-full py-2 px-4 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
                >
                  Conectar YouTube
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
            <h1 className="text-3xl font-bold tracking-tight">YouTube</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie sua conta do YouTube
              </p>
              {youtubeConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(youtubeConnection.updated_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
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
            <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-lg text-white">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-1">
                  {profile?.thumbnail_url ? (
                    <img 
                      src={profile.thumbnail_url} 
                      alt={`${profile?.title || 'YouTube Channel'} Avatar`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <PlayCircle className="w-12 h-12 text-white" />
                  )}
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    {profile?.title || 'YouTube Channel'}
                  </h3>
                  {profile?.custom_url && (
                    <p className="text-white/70 text-sm">
                      {profile.custom_url}
                    </p>
                  )}
                </div>

                {profile?.description && (
                  <p className="text-white/80 text-sm line-clamp-3">
                    {profile.description}
                  </p>
                )}

                {profile?.channel_url && (
                  <a 
                    href={profile.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium backdrop-blur border border-white/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver canal no YouTube
                  </a>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      if (disconnecting) return
                      setDisconnecting(true)
                      try {
                        await disconnect('youtube')
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
            {displayStats ? (
              <>
                <div className="p-6 border rounded-lg hover:border-red-200 dark:hover:border-red-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Inscritos</p>
                      <p className="text-2xl font-bold">{formatNumber(displayStats.subscriber_count)}</p>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                      <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border rounded-lg hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Visualizações Totais</p>
                      <p className="text-2xl font-bold">{formatNumber(displayStats.view_count)}</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                      <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border rounded-lg hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Vídeos Publicados</p>
                      <p className="text-2xl font-bold">{formatNumber(displayStats.video_count)}</p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                      <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border rounded-lg hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Comentários</p>
                      <p className="text-2xl font-bold">{formatNumber(displayStats.comment_count)}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                      <Heart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 p-6 border rounded-lg text-center">
                <p className="text-muted-foreground">Nenhuma estatística disponível</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Conecte sua conta para ver as métricas do seu canal
                </p>
              </div>
            )}
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
              <p className="text-sm text-muted-foreground">Channel ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.channel_id || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {youtubeConnection?.created_at 
                  ? new Date(youtubeConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {youtubeConnection?.updated_at 
                  ? new Date(youtubeConnection.updated_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Permissões Concedidas</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {(youtubeConnection?.scope || 'https://www.googleapis.com/auth/youtube.readonly')
                  .split(' ')
                  .map((scope, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                    >
                      {scope.replace('https://www.googleapis.com/auth/youtube.', '').replace('readonly', 'leitura')}
                    </span>
                  ))
                }
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status do Token</p>
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const now = new Date()
                  const expiresAt = youtubeConnection?.expires_at ? new Date(youtubeConnection.expires_at) : null
                  const hasValidToken = youtubeConnection?.access_token && (!expiresAt || expiresAt > now)
                  
                  if (hasValidToken) {
                    return (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">Válido</span>
                      </>
                    )
                  } else {
                    return (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600 dark:text-red-400">
                          {expiresAt && expiresAt <= now ? 'Expirado' : 'Inválido'}
                        </span>
                      </>
                    )
                  }
                })()}
              </div>
            </div>

            {profile?.published_at && (
              <div>
                <p className="text-sm text-muted-foreground">Canal criado em</p>
                <p className="text-sm flex items-center gap-1 mt-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(profile.published_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Available Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </div>
                <h4 className="font-medium">Upload de Vídeos</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Faça upload de vídeos diretamente para o YouTube
              </p>
              <span className="inline-block mt-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                Em breve
              </span>
            </div>
            
            <Link
              href="/analytics/youtube"
              className="group p-4 border rounded-lg hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                  <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h4 className="font-medium">Análise de Performance</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Veja métricas detalhadas, gráficos e histórico de crescimento
              </p>
            </Link>
            
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-500" />
                </div>
                <h4 className="font-medium">Agendar Vídeos</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Programe seus vídeos para publicação automática
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