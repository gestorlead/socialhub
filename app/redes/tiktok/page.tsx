"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useTikTokTokenStatus } from "@/hooks/use-tiktok-token-status"
import { TokenStatusIndicator } from "@/components/token-status-indicator"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Play, Heart, Clock, AlertTriangle, Unlink, Key, Copy, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

export default function TikTokPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectTikTok, getConnection, refresh, disconnect } = useSocialConnections()
  const { status: tokenStatus, refreshToken: refreshTokenStatus, refetch: refetchStatus } = useTikTokTokenStatus()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const tiktokConnection = getConnection('tiktok')

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
      const response = await fetch(`/api/social/tiktok/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        await refresh()
      }
    } catch (error) {
    } finally {
      setRefreshing(false)
    }
  }


  const copyToken = async () => {
    if (!tiktokConnection?.access_token) return
    
    try {
      await navigator.clipboard.writeText(tiktokConnection.access_token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    } catch (error) {
    }
  }

  const hasVideoPublishScope = () => {
    if (!tiktokConnection?.scope) return false
    
    // Normalize scope string and check for video.publish
    const scope = tiktokConnection.scope.toLowerCase().replace(/\s+/g, '')
    return scope.includes('video.publish') || 
           scope.includes('video_publish') ||
           scope.includes('videopublish')
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
              <div className="w-24 h-24 bg-black rounded-full mx-auto flex items-center justify-center p-6">
                <Image 
                  src="/images/social-icons/tiktok.png" 
                  alt="TikTok" 
                  width={48} 
                  height={48}
                  className="brightness-0 invert"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do TikTok</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta do TikTok.
                </p>
                <button 
                  onClick={connectTikTok}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
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

  const profile = tiktokConnection?.profile_data

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
            <div className="bg-card border rounded-lg p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-200 dark:hover:border-blue-800 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-200 dark:group-hover:shadow-blue-900 transition-shadow">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Seguidores</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatNumber(profile?.follower_count || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(profile?.follower_count || 0).toLocaleString('pt-BR')} pessoas
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                  Audiência
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6 hover:shadow-lg transition-all duration-300 hover:border-red-200 dark:hover:border-red-800 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-red-200 dark:group-hover:shadow-red-900 transition-shadow">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Curtidas Totais</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatNumber(profile?.likes_count || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(profile?.likes_count || 0).toLocaleString('pt-BR')} reações
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-1 rounded-full font-medium">
                  Engajamento
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6 hover:shadow-lg transition-all duration-300 hover:border-purple-200 dark:hover:border-purple-800 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-purple-200 dark:group-hover:shadow-purple-900 transition-shadow">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vídeos Publicados</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatNumber(profile?.video_count || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(profile?.video_count || 0).toLocaleString('pt-BR')} conteúdos
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-medium">
                  Conteúdo
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6 hover:shadow-lg transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-emerald-200 dark:group-hover:shadow-emerald-900 transition-shadow">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Seguindo</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatNumber(profile?.following_count || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(profile?.following_count || 0).toLocaleString('pt-BR')} contas
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full font-medium">
                  Rede
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Token Section */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="w-5 h-5" />
              Token para Publicação de Conteúdo
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {hasVideoPublishScope() ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Habilitado para publicar
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Sem permissão para publicar
                </span>
              )}
            </div>
          </div>

          {hasVideoPublishScope() ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Access Token para API
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-800 border rounded px-3 py-2 text-sm font-mono break-all">
                          {showToken 
                            ? tiktokConnection?.access_token 
                            : '•'.repeat(tiktokConnection?.access_token?.length || 0)
                          }
                        </code>
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          title={showToken ? 'Ocultar token' : 'Mostrar token'}
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={copyToken}
                          className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          title="Copiar token"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      {copiedToken && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Token copiado para a área de transferência!
                        </p>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-blue-700 dark:text-blue-300">
                      <p><strong>Open ID:</strong> {tiktokConnection?.profile_data?.open_id}</p>
                      <p className="mt-1">
                        <strong>Uso:</strong> Use este token para fazer requisições à Content Posting API do TikTok
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium">Escopo video.publish não encontrado</p>
                  <p>Reconecte sua conta para obter permissões de publicação</p>
                </div>
              </div>
            </div>
          )}
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

            {/* Token Status */}
            {tokenStatus && (
              <div className="md:col-span-full">
                <p className="text-sm text-muted-foreground mb-2">Status do Token</p>
                <TokenStatusIndicator
                  status={tokenStatus.status}
                  timeUntilExpiry={tokenStatus.time_until_expiry}
                  needsRefresh={tokenStatus.needs_refresh}
                  needsReconnect={tokenStatus.needs_reconnect}
                  onRefresh={async () => {
                    const result = await refreshTokenStatus()
                    if (result?.success) {
                      await refresh() // Refresh social connections
                      await refetchStatus() // Refresh token status
                    }
                  }}
                  refreshing={refreshingToken}
                />
              </div>
            )}

          </div>
        </div>

        {/* Coming Soon Features */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Em breve</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 border rounded-lg opacity-50">
              <h4 className="font-medium mb-2">Publicar Vídeos</h4>
              <p className="text-sm text-muted-foreground">
                Publique vídeos diretamente no TikTok
              </p>
            </div>
            <div className="p-4 border rounded-lg opacity-50">
              <h4 className="font-medium mb-2">Agendar Posts</h4>
              <p className="text-sm text-muted-foreground">
                Programe seus vídeos para publicação automática
              </p>
            </div>
            <div className="p-4 border rounded-lg opacity-50">
              <h4 className="font-medium mb-2">Análise de Performance</h4>
              <p className="text-sm text-muted-foreground">
                Veja métricas detalhadas dos seus vídeos
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}