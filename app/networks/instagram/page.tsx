"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { InstagramStatCard } from "@/components/instagram-stat-card"
import { useEffect, useState } from "react"
import { RefreshCw, ExternalLink, Shield, User, Calendar, BarChart3, Heart, Clock, Unlink, Edit3, TrendingUp, Eye, AlertTriangle, CheckCircle, Info, Users, UserPlus, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function InstagramPage() {
  const { user, loading } = useAuth()
  const { isConnected, connectInstagram, getConnection, refresh, disconnect } = useSocialConnections()
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)

  const instagramConnection = getConnection('instagram')
  const profile = instagramConnection?.profile_data
  
  // Fetch profile picture URL and additional stats when connection exists
  useEffect(() => {
    const fetchProfileData = async () => {
      if (profile?.id && instagramConnection?.access_token) {
        try {
          // Fetch profile picture and additional profile data
          const response = await fetch(
            `https://graph.instagram.com/${profile.id}?fields=profile_picture_url,followers_count,follows_count,media_count,biography&access_token=${instagramConnection.access_token}`
          )
          if (response.ok) {
            const data = await response.json()
            setProfilePictureUrl(data.profile_picture_url)
            // You could set additional state here for the new stats
            // For now, we'll refresh the connection to update the profile_data
            if (data.followers_count !== profile.followers_count || 
                data.follows_count !== profile.follows_count ||
                data.biography !== profile.biography) {
              // Trigger a refresh to update the stored profile data
              handleRefresh()
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error)
        }
      }
    }

    fetchProfileData()
  }, [profile?.id, instagramConnection?.access_token])
  
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
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                  className="object-contain"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
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
                  {profile?.id && instagramConnection?.access_token && profilePictureUrl ? (
                    <img 
                      src={profilePictureUrl}
                      alt={`${profile.username || 'Instagram'} Profile`}
                      className="w-full h-full rounded-full object-cover border-2 border-white/30"
                      onError={(e) => {
                        // Fallback to Instagram logo on error
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`
                        }
                      }}
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
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.40s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  )}
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

                {profile?.biography && (
                  <p className="text-white/80 text-sm">
                    {profile.biography}
                  </p>
                )}

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
            <InstagramStatCard
              icon={<Users className="w-6 h-6 text-white" />}
              title="Seguidores"
              value={profile?.followers_count || 0}
              colorClass="hover:border-blue-200 dark:hover:border-blue-800"
            />
            
            <InstagramStatCard
              icon={<UserPlus className="w-6 h-6 text-white" />}
              title="Seguindo"
              value={profile?.follows_count || 0}
              colorClass="hover:border-emerald-200 dark:hover:border-emerald-800"
            />
            
            <InstagramStatCard
              icon={<FileText className="w-6 h-6 text-white" />}
              title="Posts"
              value={profile?.media_count || 0}
              colorClass="hover:border-pink-200 dark:hover:border-pink-800"
            />

            <div className="bg-card border rounded-lg p-4 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg text-white">
                  <User className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-muted-foreground">User ID</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-mono text-sm">{profile?.id || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Instagram User ID</p>
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

            {profile?.biography && (
              <div className="md:col-span-full">
                <p className="text-sm text-muted-foreground">Biografia</p>
                <p className="text-sm bg-muted px-2 py-1 rounded mt-1">
                  {profile.biography}
                </p>
              </div>
            )}

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