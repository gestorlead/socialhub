"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useAnalyticsData } from "@/hooks/use-analytics-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Heart, 
  Play, 
  Eye,
  Download,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart
} from "lucide-react"
import { FollowersGrowthChart } from "@/components/analytics/followers-growth-chart"
import { GrowthRateChart } from "@/components/analytics/growth-rate-chart"
import { MultiMetricChart } from "@/components/analytics/multi-metric-chart"
import { VideoList } from "@/components/analytics/video-list"
import { useTikTokVideos } from "@/hooks/use-tiktok-videos"
import { formatNumber } from "@/lib/utils"

type Period = '7d' | '30d' | '60d' | '90d'

interface MetricCardProps {
  title: string
  value: number
  change: number
  changePercent: number
  icon: React.ReactNode
  color: string
}

function MetricCard({ title, value, change, changePercent, icon, color }: MetricCardProps) {
  const isPositive = change >= 0
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
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
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const { getConnection } = useSocialConnections()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  
  const tiktokConnection = getConnection('tiktok')
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError } = useAnalyticsData(
    tiktokConnection?.profile_data?.open_id,
    selectedPeriod
  )
  const { 
    videos, 
    loading: videosLoading, 
    error: videosError,
    hasMore,
    fetchMore,
    refetch
  } = useTikTokVideos(
    tiktokConnection?.profile_data?.open_id
  )

  const metrics = useMemo(() => {
    if (!analyticsData?.current || !analyticsData?.previous) return null

    const current = analyticsData.current
    const previous = analyticsData.previous

    return {
      followers: {
        current: current.follower_count,
        change: current.follower_count - previous.follower_count,
        changePercent: previous.follower_count > 0 
          ? ((current.follower_count - previous.follower_count) / previous.follower_count) * 100 
          : 0
      },
      likes: {
        current: current.likes_count,
        change: current.likes_count - previous.likes_count,
        changePercent: previous.likes_count > 0 
          ? ((current.likes_count - previous.likes_count) / previous.likes_count) * 100 
          : 0
      },
      videos: {
        current: current.video_count,
        change: current.video_count - previous.video_count,
        changePercent: previous.video_count > 0 
          ? ((current.video_count - previous.video_count) / previous.video_count) * 100 
          : 0
      },
      following: {
        current: current.following_count,
        change: current.following_count - previous.following_count,
        changePercent: previous.following_count > 0 
          ? ((current.following_count - previous.following_count) / previous.following_count) * 100 
          : 0
      }
    }
  }, [analyticsData])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!tiktokConnection) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-4">TikTok Analytics</h2>
            <p className="text-muted-foreground mb-6">
              Conecte sua conta do TikTok para visualizar suas análises de performance
            </p>
            <Button asChild>
              <a href="/redes/tiktok">Conectar TikTok</a>
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
              Acompanhe o crescimento e performance da sua conta no TikTok
            </p>
          </div>
          <div className="flex items-center gap-4">
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
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {analyticsError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <span className="font-medium">Erro ao carregar dados:</span>
              <span>{analyticsError}</span>
            </div>
          </div>
        )}


        {/* Metrics Overview */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Seguidores"
              value={metrics.followers.current}
              change={metrics.followers.change}
              changePercent={metrics.followers.changePercent}
              icon={<Users className="w-4 h-4 text-white" />}
              color="bg-blue-500"
            />
            <MetricCard
              title="Curtidas Totais"
              value={metrics.likes.current}
              change={metrics.likes.change}
              changePercent={metrics.likes.changePercent}
              icon={<Heart className="w-4 h-4 text-white" />}
              color="bg-red-500"
            />
            <MetricCard
              title="Vídeos Publicados"
              value={metrics.videos.current}
              change={metrics.videos.change}
              changePercent={metrics.videos.changePercent}
              icon={<Play className="w-4 h-4 text-white" />}
              color="bg-purple-500"
            />
            <MetricCard
              title="Seguindo"
              value={metrics.following.current}
              change={metrics.following.change}
              changePercent={metrics.following.changePercent}
              icon={<Eye className="w-4 h-4 text-white" />}
              color="bg-green-500"
            />
          </div>
        )}

        {/* Main Dashboard */}
        <div className="grid gap-6">
          {/* Followers Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="w-5 h-5" />
                Crescimento de Seguidores
              </CardTitle>
              <CardDescription>
                Evolução do número de seguidores ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FollowersGrowthChart 
                data={analyticsData?.timeSeries || []} 
                period={selectedPeriod}
                loading={analyticsLoading}
              />
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="growth" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="growth">Crescimento</TabsTrigger>
            <TabsTrigger value="engagement">Engajamento</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="comparison">Comparativo</TabsTrigger>
          </TabsList>

          <TabsContent value="growth" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Crescimento</CardTitle>
                <CardDescription>
                  Crescimento percentual por período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GrowthRateChart 
                  data={analyticsData?.growth || []}
                  loading={analyticsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Engajamento</CardTitle>
                <CardDescription>
                  Análise detalhada de interações e engajamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MultiMetricChart 
                  data={analyticsData?.timeSeries || []}
                  loading={analyticsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seus Vídeos</CardTitle>
                <CardDescription>
                  Lista dos últimos vídeos publicados com suas estatísticas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoList 
                  videos={videos}
                  loading={videosLoading}
                  error={videosError}
                  hasMore={hasMore}
                  onLoadMore={fetchMore}
                  onRefresh={refetch}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comparação de Períodos</CardTitle>
                <CardDescription>
                  Compare performance entre diferentes períodos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Comparação de períodos em desenvolvimento
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}