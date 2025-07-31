"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useInstagramInsights } from "@/hooks/use-instagram-insights"
import { useInstagramDailyStats } from "@/hooks/use-instagram-daily-stats"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useMemo } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Heart, 
  Image as ImageIcon, 
  UserPlus,
  Download,
  Instagram,
  AlertTriangle,
  RefreshCw
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InstagramGrowthChart } from "@/components/analytics/instagram-growth-chart"
import { InstagramMediaInsights } from "@/components/analytics/instagram-media-insights"
import { InstagramAudienceInsights } from "@/components/analytics/instagram-audience-insights"
import { InstagramPermissionWarning } from "@/components/analytics/instagram-permission-warning"

type Period = '7d' | '30d' | '60d' | '90d'

interface MetricCardProps {
  title: string
  value: number
  change?: number
  changePercent?: number
  icon: React.ReactNode
  color: string
}

function MetricCard({ title, value, change, changePercent, icon, color }: MetricCardProps) {
  const isPositive = change !== undefined ? change >= 0 : null
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`p-2 rounded-lg ${color} cursor-help`}>
              {icon}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{title}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
        {change !== undefined && changePercent !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 mr-1 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 mr-1 text-red-500" />
            )}
            <span className={isPositive ? "text-green-500" : "text-red-500"}>
              {isPositive ? "+" : ""}{change} ({changePercent.toFixed(1)}%)
            </span>
            <span className="ml-1">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function InstagramAnalyticsPage() {
  const { user, loading } = useAuth()
  const { getConnection, refresh } = useSocialConnections()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  const [refreshing, setRefreshing] = useState(false)
  
  const instagramConnection = getConnection('instagram')
  const profile = instagramConnection?.profile_data

  // Use the Instagram Insights hook
  const { 
    accountInsights, 
    mediaInsights, 
    loading: insightsLoading, 
    error: insightsError,
    hasMinimumFollowers,
    refetch: refetchInsights
  } = useInstagramInsights(selectedPeriod)

  // Use the Instagram Daily Stats hook for historical data
  const { 
    dailyStats, 
    growth, 
    loading: statsLoading, 
    error: statsError,
    refetch: refetchStats
  } = useInstagramDailyStats(selectedPeriod)

  const metrics = useMemo(() => {
    // Use real historical data if available, otherwise fallback to current profile data
    if (growth) {
      return {
        followers: growth.followers,
        posts: growth.media,
        following: growth.following,
        reach: growth.reach,
        impressions: growth.impressions,
        profileViews: growth.profileViews
      }
    }

    // Fallback to current profile data with no growth
    if (profile) {
      return {
        followers: {
          current: profile.followers_count || 0,
          change: 0,
          changePercent: 0
        },
        posts: {
          current: profile.media_count || 0,
          change: 0,
          changePercent: 0
        },
        following: {
          current: profile.follows_count || 0,
          change: 0,
          changePercent: 0
        },
        reach: {
          current: accountInsights?.reach || 0,
          change: 0,
          changePercent: 0
        },
        impressions: {
          current: accountInsights?.impressions || 0,
          change: 0,
          changePercent: 0
        },
        profileViews: {
          current: accountInsights?.profile_views || 0,
          change: 0,
          changePercent: 0
        }
      }
    }

    return null
  }, [profile, accountInsights, growth])

  const handleRefresh = async () => {
    if (!user) return
    
    setRefreshing(true)
    try {
      // Refresh Instagram connection data
      const response = await fetch(`/api/social/instagram/refresh?user_id=${user.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        await refresh()
        await refetchStats()
        await refetchInsights()
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!instagramConnection) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <Instagram className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-4">Instagram Analytics</h2>
            <p className="text-muted-foreground mb-6">
              Conecte sua conta do Instagram para visualizar suas análises de performance
            </p>
            <Button asChild>
              <a href="/networks/instagram">Conectar Instagram</a>
            </Button>
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
            <h1 className="text-3xl font-bold tracking-tight">Análise de Performance</h1>
            <p className="text-muted-foreground">
              Acompanhe o crescimento e performance da sua conta no Instagram
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Select
              value={selectedPeriod}
              onValueChange={(value: Period) => setSelectedPeriod(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="60d">Últimos 60 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Permission Warning */}
        <InstagramPermissionWarning 
          error={insightsError} 
          onReconnect={() => window.location.href = '/networks/instagram'} 
        />

        {/* Metrics Overview */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Seguidores"
              value={metrics.followers.current}
              change={metrics.followers.change}
              changePercent={metrics.followers.changePercent}
              icon={<Users className="w-4 h-4 text-white" />}
              color="bg-gradient-to-br from-purple-600 to-pink-600"
            />
            <MetricCard
              title="Posts"
              value={metrics.posts.current}
              change={metrics.posts.change}
              changePercent={metrics.posts.changePercent}
              icon={<ImageIcon className="w-4 h-4 text-white" />}
              color="bg-gradient-to-br from-pink-600 to-rose-600"
            />
            <MetricCard
              title="Seguindo"
              value={metrics.following.current}
              change={metrics.following.change}
              changePercent={metrics.following.changePercent}
              icon={<UserPlus className="w-4 h-4 text-white" />}
              color="bg-gradient-to-br from-purple-500 to-indigo-600"
            />
            <MetricCard
              title="Alcance (estimado)"
              value={metrics.reach.current}
              change={metrics.reach.change}
              changePercent={metrics.reach.changePercent}
              icon={<Heart className="w-4 h-4 text-white" />}
              color="bg-gradient-to-br from-orange-500 to-red-600"
            />
          </div>
        )}

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="audience">Audiência</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Profile Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Instagram className="w-5 h-5" />
                  Resumo do Perfil
                </CardTitle>
                <CardDescription>
                  Informações gerais da sua conta do Instagram
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Nome de usuário</p>
                    <p className="font-medium">@{profile?.username || 'N/A'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Tipo de conta</p>
                    <p className="font-medium">
                      {profile?.account_type === 'BUSINESS' ? 'Business' : 
                       profile?.account_type === 'CREATOR' ? 'Creator' : 'Professional'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Taxa de engajamento estimada</p>
                    <p className="font-medium">
                      {profile?.followers_count && profile?.media_count 
                        ? `${((profile.media_count / profile.followers_count) * 100).toFixed(2)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {profile?.biography && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Biografia</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{profile.biography}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Growth Charts */}
            <InstagramGrowthChart 
              data={dailyStats.map(stat => ({
                date: stat.date,
                followers: stat.follower_count,
                impressions: stat.impressions,
                reach: stat.reach,
                engagement: stat.profile_views // Using profile views as engagement proxy
              }))} 
              loading={statsLoading || insightsLoading} 
              period={selectedPeriod} 
            />
          </TabsContent>

          <TabsContent value="audience" className="space-y-6">
            <InstagramAudienceInsights
              accountInsights={accountInsights}
              mediaInsights={mediaInsights || []}
              dailyStats={dailyStats}
              loading={insightsLoading || statsLoading}
              error={insightsError}
              hasMinimumFollowers={hasMinimumFollowers}
            />
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <InstagramMediaInsights 
              mediaInsights={mediaInsights || []} 
              loading={insightsLoading} 
              error={insightsError} 
              onRefresh={refetchInsights} 
            />
          </TabsContent>
        </Tabs>

        {/* API Upgrade Notice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quer análises mais detalhadas?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Para desbloquear insights avançados como alcance, impressões, dados demográficos da audiência 
                e métricas detalhadas de posts, você precisa configurar o Instagram Graph API com permissões de Business.
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Dados básicos do perfil</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <span>Insights de alcance</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <span>Dados demográficos</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <span>Métricas de posts</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}