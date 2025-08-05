"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { ThreadsStatCard } from "@/components/threads-stat-card"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, Info, Users, MessageCircle, Repeat, Quote } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function ThreadsPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectThreads, getConnection, refresh, disconnect } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [insightsData, setInsightsData] = useState<any>(null)

  const threadsConnection = getConnection('threads')
  const profile = threadsConnection?.profile_data
  
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
      // Get comprehensive metrics
      const metricsResponse = await fetch(`/api/social/threads/metrics?user_id=${user.id}`)
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        console.log('Metrics updated:', metricsData.updated_profile)
        
        // Update insights data if available
        if (metricsData.data?.insights) {
          setInsightsData(metricsData.data.insights)
        }
        
        // Refresh the connection data
        await refresh()
      } else {
        // Fallback to basic refresh
        const response = await fetch(`/api/social/threads/refresh?user_id=${user.id}`, {
          method: 'POST'
        })
        if (response.ok) {
          await refresh()
        }
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
      await connectThreads()
    } catch (error: any) {
      setConnectError(error.message || 'Erro ao conectar Threads')
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

  if (!isConnected('threads')) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Threads</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do Threads para gerenciar seu conteúdo
            </p>
          </div>

          {/* Professional Account Alert */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Importante:</strong> Você precisa ter uma conta do Threads ativa para se conectar. 
              O Threads usa a mesma conta do Instagram.
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
              <div className="w-24 h-24 rounded-full bg-black shadow-lg flex items-center justify-center mx-auto">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Conecte sua conta do Threads</h2>
                <p className="text-muted-foreground mb-6">
                  Para começar a gerenciar seu conteúdo, você precisa conectar sua conta do Threads.
                </p>
                <button 
                  onClick={handleConnect}
                  className="mt-3 w-full py-2 px-4 bg-black text-white rounded-md text-sm hover:bg-gray-800 transition-all duration-200"
                >
                  Conectar Threads
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
            <h1 className="text-3xl font-bold tracking-tight">Threads</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                Gerencie sua conta do Threads
              </p>
              {threadsConnection?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full">
                  <Clock className="w-3 h-3" />
                  Atualizado {new Date(threadsConnection.updated_at).toLocaleDateString('pt-BR')}
                </span>
              )}
              {profile?.last_metrics_update && (
                <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950 rounded-full">
                  <BarChart3 className="w-3 h-3" />
                  Métricas: {new Date(profile.last_metrics_update).toLocaleDateString('pt-BR')}
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
            <div className="bg-black p-6 rounded-lg text-white">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-1">
                  {profile?.threads_profile_picture_url ? (
                    <img 
                      src={profile.threads_profile_picture_url}
                      alt={`${profile.username || 'Threads'} Profile`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <MessageCircle className="w-12 h-12 text-white" />
                  )}
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">
                    @{profile?.username || 'threads_user'}
                  </h3>
                  <p className="text-white/70 text-sm">
                    {profile?.name || 'Threads User'}
                  </p>
                  {profile?.threads_biography && (
                    <p className="text-white/60 text-xs mt-2">
                      {profile.threads_biography}
                    </p>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      try {
                        await disconnect('threads')
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
            <div className="relative">
              <ThreadsStatCard
                icon={<Users className="w-6 h-6 text-white" />}
                title="Seguidores"
                value={profile?.followers_count || profile?.follower_count || 0}
                colorClass="hover:border-blue-200 dark:hover:border-blue-800"
              />
              {(profile?.followers_count || profile?.follower_count) ? (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="w-4 h-4 text-green-500" title="Dados disponíveis via Insights API" />
                </div>
              ) : (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" title="Aguardando dados da API" />
                </div>
              )}
            </div>
            
            <div className="relative">
              <ThreadsStatCard
                icon={<Edit3 className="w-6 h-6 text-white" />}
                title="Posts"
                value={profile?.posts_count || 0}
                colorClass="hover:border-emerald-200 dark:hover:border-emerald-800"
              />
              <div className="absolute top-2 right-2">
                <CheckCircle className="w-4 h-4 text-green-500" title="Calculado com precisão via API" />
              </div>
            </div>
            
            <div className="relative">
              <ThreadsStatCard
                icon={<Heart className="w-6 h-6 text-white" />}
                title="Curtidas"
                value={profile?.insights_likes || profile?.total_likes || profile?.likes_count || 0}
                colorClass="hover:border-red-200 dark:hover:border-red-800"
              />
              <div className="absolute top-2 right-2">
                <CheckCircle className="w-4 h-4 text-green-500" title="Dados via Insights API" />
              </div>
            </div>


            <div className="relative">
              <ThreadsStatCard
                icon={<Repeat className="w-6 h-6 text-white" />}
                title="Reposts"
                value={profile?.insights_reposts || profile?.total_reposts || profile?.reposts_count || 0}
                colorClass="hover:border-green-200 dark:hover:border-green-800"
              />
              <div className="absolute top-2 right-2">
                <CheckCircle className="w-4 h-4 text-green-500" title="Dados via Insights API" />
              </div>
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
              <p className="text-sm text-muted-foreground">Threads User ID</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.id || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Shield className="w-4 h-4" />
                @{profile?.username || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Token Type</p>
              <p className="text-sm bg-muted px-2 py-1 rounded mt-1">
                {profile?.token_type || 'short_lived'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Conectado em</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {threadsConnection?.created_at 
                  ? new Date(threadsConnection.created_at).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="text-sm flex items-center gap-1 mt-1">
                <RefreshCw className="w-4 h-4" />
                {threadsConnection?.updated_at 
                  ? new Date(threadsConnection.updated_at).toLocaleDateString('pt-BR')
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
            <strong>Limites de Publicação:</strong> O Threads permite até 250 posts API-publicados por 24 horas, 
            1.000 respostas por 24 horas. Suporta posts de texto (500 caracteres), imagens, vídeos e carrosséis.
          </AlertDescription>
        </Alert>

        {/* Available Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/publish"
              className="group p-4 border rounded-lg hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg group-hover:bg-gray-200 dark:group-hover:bg-gray-800 transition-colors">
                  <Edit3 className="w-4 h-4 text-black dark:text-white" />
                </div>
                <h4 className="font-medium">Publicar Conteúdo</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Publique posts de texto, fotos e vídeos no Threads
              </p>
            </Link>
            
            <Link
              href="/analytics/threads"
              className="group p-4 border rounded-lg hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg group-hover:bg-gray-200 dark:group-hover:bg-gray-800 transition-colors">
                  <TrendingUp className="w-4 h-4 text-black dark:text-white" />
                </div>
                <h4 className="font-medium">Análise de Performance</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Acesse insights detalhados, views por dia, curtidas totais e métricas de engajamento
              </p>
            </Link>
            
            <div className="p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Quote className="w-4 h-4 text-gray-500" />
                </div>
                <h4 className="font-medium">Quote Posts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Crie quote posts e respostas
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