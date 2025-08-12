"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LoadingFallback } from "@/components/loading-fallback"
import { getRoleName } from "@/lib/navigation"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function Home() {
  const { user, profile, userRole, loading } = useAuth()
  const { isConnected, connectTikTok, connectInstagram, getConnection, refresh } = useSocialConnections()
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [updatingStats, setUpdatingStats] = useState(false)

  // Client-side authentication check
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login'
    }
  }, [loading, user])

  useEffect(() => {
    // Check for connection success/error in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('connected')
    const error = urlParams.get('error')
    
    if (connected) {
      setConnectionStatus(`${connected} conectado com sucesso!`)
      // Clean URL
      window.history.replaceState({}, '', '/')
      // Refresh connections after successful connection
      refresh()
    } else if (error) {
      setConnectionStatus(`Erro ao conectar: ${error}`)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [refresh])
  
  
  const updateTikTokStats = async () => {
    if (!user) return
    
    setUpdatingStats(true)
    try {
      const response = await fetch(`/api/social/tiktok/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        await refresh() // Refresh connections to show updated data
        setConnectionStatus('Perfil atualizado com sucesso!')
        setTimeout(() => setConnectionStatus(null), 3000)
      } else {
        const error = await response.json()
        setConnectionStatus('Erro ao atualizar perfil')
      }
    } catch (error) {
      setConnectionStatus('Erro ao atualizar perfil')
    } finally {
      setUpdatingStats(false)
    }
  }

  const updateInstagramStats = async () => {
    if (!user) return
    
    setUpdatingStats(true)
    try {
      const response = await fetch(`/api/social/instagram/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        await refresh() // Refresh connections to show updated data
        setConnectionStatus('Perfil do Instagram atualizado com sucesso!')
        setTimeout(() => setConnectionStatus(null), 3000)
      } else {
        const error = await response.json()
        setConnectionStatus('Erro ao atualizar perfil do Instagram')
      }
    } catch (error) {
      setConnectionStatus('Erro ao atualizar perfil do Instagram')
    } finally {
      setUpdatingStats(false)
    }
  }

  const updateFacebookStats = async () => {
    if (!user) return
    
    setUpdatingStats(true)
    try {
      const response = await fetch(`/api/social/facebook/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        await refresh() // Refresh connections to show updated data
        setConnectionStatus('Perfil do Facebook atualizado com sucesso!')
        setTimeout(() => setConnectionStatus(null), 3000)
      } else {
        const error = await response.json()
        setConnectionStatus('Erro ao atualizar perfil do Facebook')
      }
    } catch (error) {
      setConnectionStatus('Erro ao atualizar perfil do Facebook')
    } finally {
      setUpdatingStats(false)
    }
  }

  const updateYouTubeStats = async () => {
    if (!user) return
    
    setUpdatingStats(true)
    try {
      const response = await fetch(`/api/social/youtube/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        await refresh() // Refresh connections to show updated data
        setConnectionStatus('Canal do YouTube atualizado com sucesso!')
        setTimeout(() => setConnectionStatus(null), 3000)
      } else {
        const error = await response.json()
        setConnectionStatus('Erro ao atualizar canal do YouTube')
      }
    } catch (error) {
      setConnectionStatus('Erro ao atualizar canal do YouTube')
    } finally {
      setUpdatingStats(false)
    }
  }

  if (loading) {
    return (
      <LoadingFallback 
        isLoading={loading} 
        onRetry={() => window.location.reload()}
        timeoutMs={15000}
      />
    )
  }

  const roleName = getRoleName(userRole)
  const fullName = profile?.full_name || user?.email || "Usuário"

  return (
    <DashboardLayout>
      <div className="rounded-xl bg-muted/50 p-4">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bem-vindo ao SocialHub
            </h1>
            <p className="text-muted-foreground">
              Gerencie todas suas redes sociais em um só lugar
            </p>
          </div>
          
          {connectionStatus && (
            <div className={`p-3 rounded-md text-sm ${
              connectionStatus.includes('sucesso') 
                ? 'bg-green-50 dark:bg-green-950 text-green-600' 
                : 'bg-red-50 dark:bg-red-950 text-red-600'
            }`}>
              {connectionStatus}
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/publish" className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Agendar post
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  Criar agendamento
                </p>
              </div>
            </Link>
            
            <div className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Calendário
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  Ver agenda
                </p>
              </div>
            </div>
            
            <div className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Concorrentes
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  Análise comparativa
                </p>
              </div>
            </div>
            
            <div className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Relatórios
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  Métricas e insights
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Redes Sociais</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {/* Renderizar dinamicamente todas as redes sociais */}
              {[
                { 
                  id: 'tiktok', 
                  name: 'TikTok', 
                  icon: '/images/social-icons/tiktok.png',
                  gradientColors: 'from-gray-900 to-black',
                  connectPath: '/networks/tiktok',
                  connectAction: connectTikTok
                },
                { 
                  id: 'instagram', 
                  name: 'Instagram', 
                  icon: '/images/social-icons/instagram.png',
                  gradientColors: 'from-purple-600 to-pink-600',
                  connectPath: '/networks/instagram',
                  connectAction: connectInstagram
                },
                { 
                  id: 'facebook', 
                  name: 'Facebook', 
                  icon: '/images/social-icons/facebook.png',
                  gradientColors: 'from-blue-600 to-blue-700',
                  connectPath: '/networks/facebook',
                  connectAction: () => window.location.href = '/networks/facebook'
                },
                { 
                  id: 'linkedin', 
                  name: 'LinkedIn', 
                  icon: '/images/social-icons/linkedin.png',
                  gradientColors: 'from-blue-700 to-blue-800',
                  connectPath: '/networks/linkedin',
                  connectAction: () => window.location.href = '/networks/linkedin'
                },
                { 
                  id: 'youtube', 
                  name: 'YouTube', 
                  icon: '/images/social-icons/youtube.png',
                  gradientColors: 'from-red-600 to-red-700',
                  connectPath: '/networks/youtube',
                  connectAction: () => window.location.href = '/networks/youtube'
                },
                { 
                  id: 'threads', 
                  name: 'Threads', 
                  icon: '/images/social-icons/threads.png',
                  gradientColors: 'from-gray-800 to-black',
                  connectPath: '/networks/threads',
                  connectAction: () => window.location.href = '/networks/threads'
                },
                { 
                  id: 'x', 
                  name: 'X', 
                  icon: '/images/social-icons/x_icon.png',
                  gradientColors: 'from-gray-900 to-black',
                  connectPath: '/networks/x',
                  connectAction: () => window.location.href = '/networks/x'
                }
              ].map((network) => {
                const connection = getConnection(network.id)
                const isNetworkConnected = isConnected(network.id)

                if (isNetworkConnected && connection) {
                  // Card da rede conectada
                  return (
                    <Link 
                      key={network.id}
                      href={network.connectPath} 
                      className={`relative overflow-hidden rounded-lg border bg-gradient-to-br ${network.gradientColors} p-4 text-white hover:shadow-lg transition-shadow cursor-pointer group`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-2 group-hover:bg-white/30 transition-colors">
                            <img 
                              src={network.icon} 
                              alt={network.name} 
                              className="w-6 h-6 object-contain"
                            />
                          </div>
                          <div>
                            <h4 className="font-medium flex items-center gap-1 group-hover:text-white/90 transition-colors">
                              {network.id === 'facebook' ? connection.profile_data?.selected_page?.name || `${network.name} Page` : 
                               network.id === 'youtube' ? connection.profile_data?.title || `${network.name} Channel` :
                               network.id === 'x' ? connection.profile_data?.name || connection.profile_data?.username || `${network.name} User` :
                               connection.profile_data?.username || connection.profile_data?.display_name || `${network.name} User`}
                            </h4>
                            {network.id === 'facebook' ? (
                              <p className="text-xs text-white/60">
                                {connection.profile_data?.selected_page?.category}
                              </p>
                            ) : network.id === 'youtube' ? (
                              connection.profile_data?.custom_url && (
                                <p className="text-xs text-white/60">
                                  {connection.profile_data.custom_url}
                                </p>
                              )
                            ) : network.id === 'x' ? (
                              connection.profile_data?.username && (
                                <p className="text-xs text-white/60">
                                  @{connection.profile_data.username}
                                </p>
                              )
                            ) : (
                              connection.profile_data?.display_name && connection.profile_data?.username !== connection.profile_data?.display_name && (
                                <p className="text-xs text-white/60">
                                  {connection.profile_data.display_name}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                        {/* Botão de refresh para TikTok, Instagram, Facebook e YouTube */}
                        {(network.id === 'tiktok' || network.id === 'instagram' || network.id === 'facebook' || network.id === 'youtube') && (
                          <button 
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (network.id === 'tiktok') {
                                updateTikTokStats()
                              } else if (network.id === 'instagram') {
                                updateInstagramStats()
                              } else if (network.id === 'facebook') {
                                updateFacebookStats()
                              } else if (network.id === 'youtube') {
                                updateYouTubeStats()
                              }
                            }}
                            disabled={updatingStats}
                            className="text-white/80 hover:text-white disabled:opacity-50 transition-colors z-10"
                            title="Atualizar estatísticas"
                          >
                            <RefreshCw className={`w-5 h-5 ${updatingStats ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-4">
                          <div>
                            <p className="text-white/60 text-xs uppercase tracking-wider">
                              {network.id === 'facebook' ? 'Curtidas' : 
                               network.id === 'youtube' ? 'Inscritos' : 
                               network.id === 'x' ? 'Seguidores' : 'Seguidores'}
                            </p>
                            <p className="font-bold text-xl">
                              {network.id === 'facebook' ? connection.profile_data?.selected_page?.fan_count?.toLocaleString('pt-BR') || '0' : 
                               network.id === 'youtube' ? connection.profile_data?.subscriber_count?.toLocaleString('pt-BR') || '0' :
                               network.id === 'x' ? connection.profile_data?.followers_count?.toLocaleString('pt-BR') || '0' :
                               connection.profile_data?.follower_count?.toLocaleString('pt-BR') || 
                               connection.profile_data?.followers_count?.toLocaleString('pt-BR') || '0'}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 text-xs uppercase tracking-wider">
                              {network.id === 'facebook' ? 'Seguidores' : 
                               network.id === 'youtube' ? 'Vídeos' : 
                               network.id === 'x' ? 'Seguindo' : 'Seguindo'}
                            </p>
                            <p className="font-medium">
                              {network.id === 'facebook' ? connection.profile_data?.selected_page?.followers_count?.toLocaleString('pt-BR') || '0' : 
                               network.id === 'youtube' ? connection.profile_data?.video_count?.toLocaleString('pt-BR') || '0' :
                               network.id === 'x' ? connection.profile_data?.following_count?.toLocaleString('pt-BR') || '0' :
                               connection.profile_data?.following_count?.toLocaleString('pt-BR') || 
                               connection.profile_data?.follows_count?.toLocaleString('pt-BR') || '0'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-white/60 text-xs uppercase tracking-wider">Conectado em</p>
                          <p className="text-xs">
                            {connection.created_at 
                              ? new Date(connection.created_at).toLocaleDateString('pt-BR')
                              : 'Hoje'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                } else {
                  // Card para conectar a rede
                  return (
                    <div key={network.id} className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mb-3">
                        <img 
                          src={network.icon} 
                          alt={network.name} 
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <h4 className="font-medium mb-1">{network.name}</h4>
                      <button 
                        onClick={network.connectAction}
                        className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                      >
                        Conectar
                      </button>
                    </div>
                  )
                }
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
