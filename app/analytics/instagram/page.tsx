"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useMemo, useEffect } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Heart, 
  Image as ImageIcon, 
  UserPlus,
  Download,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Instagram,
  AlertTriangle,
  RefreshCw
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

  // Mock analytics data - In a real app, you'd fetch this from Instagram Insights API
  // Note: Instagram Basic Display API doesn't provide insights data
  // You need Instagram Graph API with business permissions for insights
  const mockAnalyticsData = useMemo(() => {
    if (!profile) return null

    // Generate some mock historical data for demonstration
    const baseFollowers = profile.followers_count || 0
    const basePosts = profile.media_count || 0
    const baseFollowing = profile.follows_count || 0

    return {
      current: {
        followers: baseFollowers,
        posts: basePosts,
        following: baseFollowing,
        reach: Math.floor(baseFollowers * 0.6), // Mock reach data
        impressions: Math.floor(baseFollowers * 1.2), // Mock impressions
        profile_visits: Math.floor(baseFollowers * 0.1) // Mock profile visits
      },
      previous: {
        followers: Math.max(0, baseFollowers - Math.floor(Math.random() * 100)),
        posts: Math.max(0, basePosts - Math.floor(Math.random() * 5)),
        following: Math.max(0, baseFollowing - Math.floor(Math.random() * 20)),
        reach: Math.floor(baseFollowers * 0.5),
        impressions: Math.floor(baseFollowers * 1.0),
        profile_visits: Math.floor(baseFollowers * 0.08)
      }
    }
  }, [profile])

  const metrics = useMemo(() => {
    if (!mockAnalyticsData) return null

    const current = mockAnalyticsData.current
    const previous = mockAnalyticsData.previous

    return {
      followers: {
        current: current.followers,
        change: current.followers - previous.followers,
        changePercent: previous.followers > 0 
          ? ((current.followers - previous.followers) / previous.followers) * 100 
          : 0
      },
      posts: {
        current: current.posts,
        change: current.posts - previous.posts,
        changePercent: previous.posts > 0 
          ? ((current.posts - previous.posts) / previous.posts) * 100 
          : 0
      },
      following: {
        current: current.following,
        change: current.following - previous.following,
        changePercent: previous.following > 0 
          ? ((current.following - previous.following) / previous.following) * 100 
          : 0
      },
      reach: {
        current: current.reach,
        change: current.reach - previous.reach,
        changePercent: previous.reach > 0 
          ? ((current.reach - previous.reach) / previous.reach) * 100 
          : 0
      }
    }
  }, [mockAnalyticsData])

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

        {/* Instagram API Limitation Notice */}
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Limitações da API do Instagram:</strong> Os dados de análise mostrados são baseados nas informações básicas do perfil. 
            Para métricas detalhadas de insights (alcance, impressões, etc.), é necessário acesso à Instagram Graph API com permissões de Business.
          </AlertDescription>
        </Alert>

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

            {/* Growth Metrics */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Crescimento de Seguidores</CardTitle>
                  <CardDescription>
                    Evolução baseada nos dados disponíveis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Gráfico disponível com Instagram Graph API</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Conteúdo</CardTitle>
                  <CardDescription>
                    Análise dos tipos de posts publicados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    <div className="text-center">
                      <PieChart className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Análise disponível com API de Insights</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audience" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Audiência</CardTitle>
                <CardDescription>
                  Dados demográficos e comportamentais dos seus seguidores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-60 text-muted-foreground">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Insights de Audiência</h3>
                    <p className="text-sm">Para visualizar dados detalhados da audiência,</p>
                    <p className="text-sm">é necessário configurar o Instagram Graph API</p>
                    <p className="text-sm">com permissões de Business Insights.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance do Conteúdo</CardTitle>
                <CardDescription>
                  Análise detalhada dos seus posts mais recentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-60 text-muted-foreground">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Análise de Posts</h3>
                    <p className="text-sm">Para visualizar métricas de posts individuais</p>
                    <p className="text-sm">(curtidas, comentários, alcance, impressões),</p>
                    <p className="text-sm">é necessário integração com Instagram Graph API.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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