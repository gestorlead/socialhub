"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, MessageSquare, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function XPage() {
  const { user, loading, session } = useAuth()
  const { isConnected, getConnection, refresh, disconnect, connectX } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [counts, setCounts] = useState<{ total?: number, source?: 'all' | 'recent', both?: { all: number|null, recent: number|null } } | null>(null)

  // Helper to avoid long-hanging requests
  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, ms = 12000) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      return res
    } finally {
      clearTimeout(id)
    }
  }

  const xConnection = getConnection('x')
  const profile = xConnection?.profile_data
  
  // Use profile data for stats display
  const displayStats = profile ? {
    followers_count: profile.public_metrics?.followers_count || 0,
    following_count: profile.public_metrics?.following_count || 0,
    tweet_count: profile.public_metrics?.tweet_count || 0,
    listed_count: profile.public_metrics?.listed_count || 0
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

  const handleConnect = async () => {
    if (!user) return
    setConnecting(true)
    setErrorMsg(null)
    try {
      // 1) Buscar configurações para obter client_id, callback_url e scopes
      const token = session?.access_token
      const settingsRes = await fetch('/api/admin/integrations/x', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!settingsRes.ok) {
        const err = await settingsRes.json().catch(() => ({}))
        throw new Error(err.error || 'Falha ao carregar configurações do X')
      }
      const settingsJson = await settingsRes.json()
      const cfg = settingsJson?.data || {}

      const client_id = cfg.client_id
      const redirect_uri = cfg.callback_url
      const scopes: string[] = cfg.scopes || ['tweet.read','tweet.write','users.read','offline.access','media.write']
      if (!client_id || !redirect_uri) {
        throw new Error('Configuração inválida: client_id ou callback_url ausente')
      }

      // 2) Gerar URL de autorização (PKCE)
      const authRes = await fetch('/api/auth/x/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, redirect_uri, scopes, user_id: user.id, client_type: cfg.client_type || 'public' })
      })
      const authJson = await authRes.json().catch(() => ({}))
      if (!authRes.ok || !authJson?.authorize_url) {
        throw new Error(authJson.error || 'Falha ao iniciar OAuth do X')
      }

      // 3) Redirecionar usuário para o consentimento
      window.location.href = authJson.authorize_url
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao conectar com X')
    } finally {
      setConnecting(false)
    }
  }

  const handleRefresh = async () => {
    if (!user) return
    
    setRefreshing(true)
    try {
      // 1) Tenta refresh remoto com timeout; não bloqueia infinito
      try {
        const response = await fetchWithTimeout(`/api/social/x/refresh?user_id=${user.id}`, { method: 'POST' }, 12000)
        if (response.ok) {
          await refresh()
        }
      } catch (e) {
        console.warn('X refresh timeout/erro, seguindo com dados locais')
      }

      // 2) Busca counts com timeout, mas não manter loading se falhar
      try {
        const cRes = await fetchWithTimeout(`/api/social/x/counts?user_id=${user.id}`, {}, 10000)
        const cJson = await cRes.json().catch(()=>({}))
        if (cRes.ok && cJson?.success) {
          const total = (typeof cJson?.totals?.all === 'number') ? cJson.totals.all : cJson.totals?.recent
          const source = (typeof cJson?.totals?.all === 'number') ? 'all' : 'recent'
          setCounts({ total, source, both: { all: cJson?.totals?.all ?? null, recent: cJson?.totals?.recent ?? null } })
        } else {
          setCounts(null)
        }
      } catch (e) {
        setCounts(null)
      }
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleDisconnect = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      const ok = window.confirm('Tem certeza que deseja desconectar sua conta do X?')
      if (!ok) return
      await disconnect('x')
      // Redirect to dashboard after disconnect
      window.location.href = '/'
    } catch (error) {
      setErrorMsg('Erro ao desconectar conta. Tente novamente.')
    } finally {
      setDisconnecting(false)
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

  if (!isConnected('x')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {errorMsg && (
            <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded">{errorMsg}</div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">X (Twitter)</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do X para gerenciar seu conteúdo
            </p>
          </div>

          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mx-auto">
                <img 
                  src="/images/social-icons/x_icon.png" 
                  alt="X" 
                  className="w-16 h-16 object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do X</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta do X.
                </p>
                <button 
                  onClick={handleConnect}
                  disabled={connecting}
                  className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Conectando...
                    </div>
                  ) : (
                    'Conectar X'
                  )}
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
            <h1 className="text-3xl font-bold tracking-tight">X (Twitter)</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie sua conta do X
              </p>
              {xConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(xConnection.updated_at).toLocaleDateString('pt-BR')}
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
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Reautenticar X
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
                  {profile?.profile_image_url ? (
                    <img 
                      src={profile.profile_image_url.replace('_normal', '_400x400')} 
                      alt={`${profile?.name || 'X User'} Avatar`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                      onError={(e) => {
                        // Fallback to normal size
                        const target = e.target as HTMLImageElement
                        if (!target.src.includes('_normal')) {
                          target.src = profile.profile_image_url
                        }
                      }}
                    />
                  ) : (
                    <Image 
                      src="/images/social-icons/x_icon.png" 
                      alt="X" 
                      width={48} 
                      height={48}
                      className="brightness-0 invert"
                    />
                  )}
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    {profile?.name || 'X User'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    @{profile?.username || 'username'}
                  </p>
                  {profile?.verified && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-blue-400">Verificado</span>
                    </div>
                  )}
                </div>

                {profile?.username && (
                  <a 
                    href={`https://x.com/${profile.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium backdrop-blur border border-white/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver perfil no X
                  </a>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={handleDisconnect}
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
                <div className="bg-card border rounded-lg p-6 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(displayStats.followers_count)}</p>
                    <p className="text-sm text-muted-foreground">Seguidores</p>
                  </div>
                </div>
                
            <div className="bg-card border rounded-lg p-6 hover:border-red-200 dark:hover:border-red-800 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                      <MessageSquare className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <div>
                <p className="text-2xl font-bold">{formatNumber(counts?.total ?? displayStats.tweet_count)}</p>
                <p className="text-sm text-muted-foreground">Posts {counts?.source ? `(${counts.source})` : ''}</p>
                {counts?.both && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {typeof counts.both.all === 'number' ? `All: ${formatNumber(counts.both.all)} • ` : ''}
                    {typeof counts.both.recent === 'number' ? `Recent: ${formatNumber(counts.both.recent)}` : ''}
                  </p>
                )}
                  </div>
                </div>
                
                <div className="bg-card border rounded-lg p-6 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                      <Eye className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(displayStats.following_count)}</p>
                    <p className="text-sm text-muted-foreground">Seguindo</p>
                  </div>
                </div>
                
                <div className="bg-card border rounded-lg p-6 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(displayStats.listed_count)}</p>
                    <p className="text-sm text-muted-foreground">Listas</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.id || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {xConnection?.created_at 
                  ? new Date(xConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {xConnection?.updated_at 
                  ? new Date(xConnection.updated_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Permissões Concedidas</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {(xConnection?.scope || 'tweet.read,tweet.write,users.read,offline.access')
                  .split(',')
                  .map((scope, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                    >
                      {scope.trim().replace('tweet.', '').replace('users.', 'user.')}
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
                  const expiresAt = xConnection?.expires_at ? new Date(xConnection.expires_at) : null
                  const hasValidToken = xConnection?.access_token && (!expiresAt || expiresAt > now)
                  
                  if (hasValidToken) {
                    const mins = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60000)) : null
                    return (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Válido{mins !== null ? ` • expira em ${mins} min` : ''}
                        </span>
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

            <div>
              <p className="text-sm text-muted-foreground">Limite Free Tier</p>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                100 posts/mês
              </p>
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
                <h4 className="font-medium">Publicar Posts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Publique posts de texto e imagens diretamente no X
              </p>
              <span className="inline-block mt-2 text-xs bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full">
                100/mês
              </span>
              {(() => {
                const scopeStr = (xConnection?.scope || '').toString()
                const hasWrite = scopeStr.includes('tweet.write')
                const hasMedia = scopeStr.includes('media.write')
                if (!hasWrite || !hasMedia) {
                  return (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Escopos insuficientes para publicar imagens. Clique em "Reautenticar X" para conceder tweet.write e media.write.
                    </div>
                  )
                }
                return null
              })()}
            </Link>
            
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-medium">Analytics</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Veja métricas detalhadas e histórico de crescimento
              </p>
              <span className="inline-block mt-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                Em breve
              </span>
            </div>
            
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-500" />
                </div>
                <h4 className="font-medium">Agendar Posts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Programe seus posts para publicação automática
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