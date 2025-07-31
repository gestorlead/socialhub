"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useTikTokTokenStatus } from "@/hooks/use-tiktok-token-status"
import { useTikTokLiveStats } from "@/hooks/use-tiktok-live-stats"
import { TikTokStatCard } from "@/components/tiktok-stat-card"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Play, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function TikTokPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectTikTok, getConnection, refresh, disconnect } = useSocialConnections()
  const { status: tokenStatus, refreshToken: refreshTokenStatus, refetch: refetchStatus } = useTikTokTokenStatus()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const tiktokConnection = getConnection('tiktok')
  const profile = tiktokConnection?.profile_data
  
  // Use live stats hook
  const storedStats = profile ? {
    follower_count: profile.follower_count || 0,
    following_count: profile.following_count || 0,
    likes_count: profile.likes_count || 0,
    video_count: profile.video_count || 0
  } : null
  
  const { liveStats, comparison, loading: statsLoading, refetch: refetchLiveStats } = useTikTokLiveStats(storedStats)
  
  // Use live stats if available, otherwise fall back to stored stats
  const displayStats = liveStats || storedStats
  

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

  useEffect(() => {
    if (tiktokConnection) {
      refetchStatus() // Update token status when connection changes
    }
  }, [tiktokConnection, refetchStatus])

  const handleRefresh = async () => {
    if (!user) return
    
    setRefreshing(true)
    try {
      // Refresh live stats
      await refetchLiveStats()
      
      // Also refresh profile data
      const response = await fetch(`/api/social/tiktok/refresh?user_id=${user.id}`, {
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



  const handleRefreshToken = async () => {
    if (!user) return
    
    setRefreshingToken(true)
    try {
      const response = await fetch(`/api/auth/tiktok/refresh-token?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        await refresh()
      }
    } catch (error) {
    } finally {
      setRefreshingToken(false)
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

  if (!isConnected('tiktok')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">TikTok</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do TikTok para gerenciar seu conteúdo
            </p>
          </div>


          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mx-auto">
                <img 
                  src="/images/social-icons/tiktok.png" 
                  alt="TikTok" 
                  className="w-16 h-16 object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do TikTok</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta do TikTok.
                </p>
                <button 
                  onClick={() => connectTikTok()}
                  className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                >
                  Conectar TikTok
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
            <h1 className="text-3xl font-bold tracking-tight">TikTok</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie sua conta do TikTok
              </p>
              {tiktokConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(tiktokConnection.updated_at).toLocaleDateString('pt-BR')}
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
            <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-lg text-white">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-1">
                  {(profile?.avatar_large_url || profile?.avatar_url_100 || profile?.avatar_url) ? (
                    <img 
                      src={profile.avatar_large_url || profile.avatar_url_100 || profile.avatar_url} 
                      alt={`${profile?.display_name || 'TikTok User'} Avatar`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                      onError={(e) => {
                        // Fallback hierarchy: large -> 100 -> regular -> default
                        const target = e.target as HTMLImageElement
                        if (target.src === profile?.avatar_large_url && profile?.avatar_url_100) {
                          target.src = profile.avatar_url_100
                        } else if (target.src === profile?.avatar_url_100 && profile?.avatar_url) {
                          target.src = profile.avatar_url
                        }
                      }}
                    />
                  ) : (
                    <Image 
                      src="/images/social-icons/tiktok.png" 
                      alt="TikTok" 
                      width={48} 
                      height={48}
                      className="brightness-0 invert"
                    />
                  )}
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    {profile?.display_name || 'TikTok User'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    @{profile?.username || 'username'}
                  </p>
                  {profile?.is_verified && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-blue-400">Verificado</span>
                    </div>
                  )}
                </div>

                {profile?.bio_description && (
                  <p className="text-white/80 text-sm">
                    {profile.bio_description}
                  </p>
                )}

                {profile?.profile_deep_link && (
                  <a 
                    href={profile.profile_deep_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium backdrop-blur border border-white/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver perfil no TikTok
                  </a>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      if (disconnecting) return
                      setDisconnecting(true)
                      try {
                        await disconnect('tiktok')
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
            {statsLoading && !displayStats ? (
              <div className="col-span-2 flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : displayStats ? (
              <>
                <TikTokStatCard
                  icon={<User className="w-6 h-6 text-white" />}
                  title="Seguidores"
                  value={displayStats.follower_count}
                  previousValue={storedStats?.follower_count}
                  change={comparison?.changes.follower_count}
                  difference={comparison?.differences.follower_count}
                  colorClass="hover:border-blue-200 dark:hover:border-blue-800"
                />
                
                <TikTokStatCard
                  icon={<Heart className="w-6 h-6 text-white" />}
                  title="Curtidas Totais"
                  value={displayStats.likes_count}
                  previousValue={storedStats?.likes_count}
                  change={comparison?.changes.likes_count}
                  difference={comparison?.differences.likes_count}
                  colorClass="hover:border-red-200 dark:hover:border-red-800"
                />
                
                <TikTokStatCard
                  icon={<Play className="w-6 h-6 text-white" />}
                  title="Vídeos Publicados"
                  value={displayStats.video_count}
                  previousValue={storedStats?.video_count}
                  change={comparison?.changes.video_count}
                  difference={comparison?.differences.video_count}
                  colorClass="hover:border-purple-200 dark:hover:border-purple-800"
                />
                
                <TikTokStatCard
                  icon={<Eye className="w-6 h-6 text-white" />}
                  title="Seguindo"
                  value={displayStats.following_count}
                  previousValue={storedStats?.following_count}
                  change={comparison?.changes.following_count}
                  difference={comparison?.differences.following_count}
                  colorClass="hover:border-emerald-200 dark:hover:border-emerald-800"
                />
              </>
            ) : null}
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
              <p className="text-sm text-muted-foreground">Open ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.open_id || 'N/A'}
              </p>
            </div>

            {profile?.union_id && (
              <div>
                <p className="text-sm text-muted-foreground">Union ID</p>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                  {profile.union_id}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {tiktokConnection?.created_at 
                  ? new Date(tiktokConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {tiktokConnection?.updated_at 
                  ? new Date(tiktokConnection.updated_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Permissões Concedidas</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {(tiktokConnection?.scope || 'user.info.basic,video.publish')
                  .split(',')
                  .map((scope, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                    >
                      {scope.trim().replace('user.info.', '').replace('video.', '')}
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
                  const expiresAt = tiktokConnection?.expires_at ? new Date(tiktokConnection.expires_at) : null
                  const hasValidToken = tiktokConnection?.access_token && (!expiresAt || expiresAt > now)
                  
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

          </div>
        </div>

        {/* Available Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/publish"
              className="group p-4 border rounded-lg hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <Edit3 className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-medium">Publicar Vídeos</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Publique vídeos diretamente no TikTok com legendas personalizadas
              </p>
            </Link>
            
            <Link
              href="/analytics/tiktok"
              className="group p-4 border rounded-lg hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                <h4 className="font-medium">Agendar Posts</h4>
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