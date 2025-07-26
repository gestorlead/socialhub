"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getRoleName } from "@/lib/navigation"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useDashboardTranslations, useCommonTranslations } from "@/hooks/useAppTranslations"
import { useAppFormatter } from "@/lib/formatting"

export default function Home() {
  const { user, profile, userRole, loading } = useAuth()
  const { isConnected, connectTikTok, getConnection, refresh } = useSocialConnections()
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [updatingStats, setUpdatingStats] = useState(false)
  
  // Translation hooks
  const t = useDashboardTranslations()
  const tCommon = useCommonTranslations()
  const formatter = useAppFormatter()

  useEffect(() => {
    // Check for connection success/error in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('connected')
    const error = urlParams.get('error')
    
    if (connected) {
      setConnectionStatus(`${connected} ${tCommon('status.connected')}!`)
      // Clean URL
      window.history.replaceState({}, '', '/')
      // Refresh connections after successful connection
      refresh()
    } else if (error) {
      setConnectionStatus(`${tCommon('errors.connectionFailed')}: ${error}`)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [refresh, tCommon])
  
  // Log TikTok connection data for debugging
  useEffect(() => {
    const tiktokConnection = getConnection('tiktok')
    if (tiktokConnection) {
      // Debug connection data
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
        setConnectionStatus(tCommon('actions.refresh') + ' ' + tCommon('status.completed'))
        setTimeout(() => setConnectionStatus(null), 3000)
      } else {
        const error = await response.json()
        setConnectionStatus(tCommon('errors.generic'))
      }
    } catch (error) {
      setConnectionStatus(tCommon('errors.generic'))
    } finally {
      setUpdatingStats(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{tCommon('actions.loading')}</p>
      </div>
    )
  }

  const roleName = getRoleName(userRole)
  const fullName = profile?.full_name || user?.email || "User"

  return (
    <DashboardLayout>
      <div className="rounded-xl bg-muted/50 p-4">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('welcome.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('welcome.subtitle')}
            </p>
          </div>
          
          {connectionStatus && (
            <div className={`p-3 rounded-md text-sm ${
              connectionStatus.includes(tCommon('status.completed')) 
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
                    {t('cards.schedule.title')}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {t('cards.schedule.description')}
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
                    {t('cards.calendar.title')}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {t('cards.calendar.description')}
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
                    {t('cards.analytics.title')}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  {t('cards.analytics.description')}
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
                    {tCommon('navigation.analytics')}
                  </p>
                </div>
                <p className="text-lg font-semibold">
                  Reports & Insights
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">{tCommon('navigation.networks')}</h3>
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
                      title={tCommon('actions.refresh')}
                    >
                      <RefreshCw className={`w-5 h-5 ${updatingStats ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-white/60 text-xs uppercase tracking-wider">{t('stats.followers')}</p>
                        <p className="font-bold text-xl">
                          {formatter.number(getConnection('tiktok')?.profile_data?.follower_count || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs uppercase tracking-wider">{t('stats.following')}</p>
                        <p className="font-medium">
                          {formatter.number(getConnection('tiktok')?.profile_data?.following_count || 0)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/60 text-xs uppercase tracking-wider">{tCommon('status.connected')}</p>
                      <p className="text-xs">
                        {getConnection('tiktok')?.created_at 
                          ? formatter.dateShort(getConnection('tiktok')!.created_at)
                          : tCommon('time.today')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <img 
                      src="/images/social-icons/tiktok.png" 
                      alt="TikTok" 
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <h4 className="font-medium mb-1">TikTok</h4>
                  <button 
                    onClick={connectTikTok}
                    className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                  >
                    {tCommon('actions.connect')}
                  </button>
                </div>
              )}

              {/* Other social networks with translations */}
              <div className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <img 
                    src="/images/social-icons/instagram.png" 
                    alt="Instagram" 
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <h4 className="font-medium mb-1">Instagram</h4>
                <button className="mt-3 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                  {tCommon('actions.connect')}
                </button>
              </div>

              {/* Continue with other social networks... */}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}