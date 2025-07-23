"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getRoleName } from "@/lib/navigation"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function Home() {
  const { user, profile, userRole, loading } = useAuth()
  const { isConnected, connectTikTok, getConnection, refresh } = useSocialConnections()
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [updatingStats, setUpdatingStats] = useState(false)

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
  
  // Log TikTok connection data for debugging
  useEffect(() => {
    const tiktokConnection = getConnection('tiktok')
    if (tiktokConnection) {
    }
  }, [getConnection])
  
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
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
            <Link href="/publicar" className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer">
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* TikTok */}
              {isConnected('tiktok') ? (
                <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-gray-900 to-black p-4 text-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center p-2">
                        <Image 
                          src="/images/social-icons/tiktok.png" 
                          alt="TikTok" 
                          width={24} 
                          height={24}
                          className="brightness-0 invert"
                        />
                      </div>
                      <div>
                        <h4 className="font-medium flex items-center gap-1">
                          @{getConnection('tiktok')?.profile_data?.username || getConnection('tiktok')?.profile_data?.display_name || 'TikTok User'}
                        </h4>
                        {getConnection('tiktok')?.profile_data?.display_name && (
                          <p className="text-xs text-white/60">
                            {getConnection('tiktok')?.profile_data?.display_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={updateTikTokStats}
                      disabled={updatingStats}
                      className="text-white/80 hover:text-white disabled:opacity-50 transition-colors"
                      title="Atualizar estatísticas"
                    >
                      <RefreshCw className={`w-5 h-5 ${updatingStats ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-white/60 text-xs uppercase tracking-wider">Seguidores</p>
                        <p className="font-bold text-xl">
                          {getConnection('tiktok')?.profile_data?.follower_count?.toLocaleString('pt-BR') || '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs uppercase tracking-wider">Seguindo</p>
                        <p className="font-medium">
                          {getConnection('tiktok')?.profile_data?.following_count?.toLocaleString('pt-BR') || '0'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/60 text-xs uppercase tracking-wider">Conectado em</p>
                      <p className="text-xs">
                        {getConnection('tiktok')?.created_at 
                          ? new Date(getConnection('tiktok')!.created_at).toLocaleDateString('pt-BR')
                          : 'Hoje'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-3 p-4">
                    <Image 
                      src="/images/social-icons/tiktok.png" 
                      alt="TikTok" 
                      width={40} 
                      height={40}
                      className="brightness-0 invert"
                    />
                  </div>
                  <h4 className="font-medium mb-1">TikTok</h4>
                  <button 
                    onClick={connectTikTok}
                    className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                  >
                    Conectar
                  </button>
                </div>
              )}

              {/* Instagram */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">IG</span>
                </div>
                <h4 className="font-medium mb-1">Instagram</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  Conectar
                </button>
              </div>

              {/* Facebook */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">FB</span>
                </div>
                <h4 className="font-medium mb-1">Facebook</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  Conectar
                </button>
              </div>

              {/* LinkedIn */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">IN</span>
                </div>
                <h4 className="font-medium mb-1">LinkedIn</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  Conectar
                </button>
              </div>

              {/* YouTube */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">YT</span>
                </div>
                <h4 className="font-medium mb-1">YouTube</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  Conectar
                </button>
              </div>

              {/* Threads */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">@</span>
                </div>
                <h4 className="font-medium mb-1">Threads</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  Conectar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
