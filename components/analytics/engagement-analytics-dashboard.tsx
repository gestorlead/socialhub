"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  AreaChart, 
  Area, 
  ScatterChart, 
  Scatter, 
  LineChart, 
  Line,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts'
import { ChartContainer } from "@/components/ui/chart"
import { DailyStats } from '@/hooks/use-analytics-data'
import { formatNumber } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  ThumbsUp,
  Play,
  Users,
  BarChart3
} from 'lucide-react'

interface EngagementAnalyticsDashboardProps {
  data: DailyStats[]
  loading?: boolean
}

// Simple metrics calculations using only real data
const calculateRealMetrics = (data: DailyStats[]) => {
  if (!data || data.length === 0) return null

  const latest = data[data.length - 1]
  const previous = data.length > 1 ? data[data.length - 2] : latest

  // Basic engagement rate (only real calculation)
  const currentEngagementRate = latest.follower_count > 0 
    ? (latest.likes_count / latest.follower_count) * 100 
    : 0

  const previousEngagementRate = previous.follower_count > 0 
    ? (previous.likes_count / previous.follower_count) * 100 
    : 0

  // Simple velocity (difference between periods)
  const engagementChange = currentEngagementRate - previousEngagementRate

  // Average likes per video (if any videos exist)
  const avgLikesPerVideo = latest.video_count > 0 
    ? latest.likes_count / latest.video_count 
    : 0

  // Follower growth
  const followerGrowth = previous.follower_count > 0
    ? ((latest.follower_count - previous.follower_count) / previous.follower_count) * 100
    : 0

  return {
    currentEngagementRate,
    engagementChange,
    avgLikesPerVideo,
    followerGrowth,
    totalFollowers: latest.follower_count,
    totalLikes: latest.likes_count,
    totalVideos: latest.video_count
  }
}

// Prepare chart data with only real metrics
const prepareChartData = (data: DailyStats[]) => {
  return data.map((item, index) => {
    const engagementRate = item.follower_count > 0 
      ? (item.likes_count / item.follower_count) * 100 
      : 0

    const followerGrowth = index > 0 && data[index - 1].follower_count > 0
      ? ((item.follower_count - data[index - 1].follower_count) / data[index - 1].follower_count) * 100
      : 0

    return {
      date: new Date(item.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      engagementRate: Number(engagementRate.toFixed(2)),
      followerGrowth: Number(followerGrowth.toFixed(2)),
      likesPerVideo: item.video_count > 0 ? Math.round(item.likes_count / item.video_count) : 0,
      followers: item.follower_count,
      likes: item.likes_count,
      videos: item.video_count
    }
  })
}

export function EngagementAnalyticsDashboard({ data, loading }: EngagementAnalyticsDashboardProps) {
  const metrics = useMemo(() => calculateRealMetrics(data), [data])
  const chartData = useMemo(() => prepareChartData(data), [data])

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (!metrics || !chartData.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">Dados Insuficientes</h3>
        <p>Aguarde a coleta de mais dados para análises de engajamento</p>
      </div>
    )
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <TrendingUp className="w-4 h-4 text-gray-500" />
  }

  return (
    <div className="space-y-6">
      {/* Real Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Engajamento</p>
                <p className="text-2xl font-bold">{metrics.currentEngagementRate.toFixed(2)}%</p>
              </div>
              <ThumbsUp className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mudança</p>
                <p className="text-2xl font-bold">{metrics.engagementChange.toFixed(2)}%</p>
              </div>
              {getTrendIcon(metrics.engagementChange)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Likes por Vídeo</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.avgLikesPerVideo)}</p>
              </div>
              <Play className="w-8 h-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crescimento</p>
                <p className="text-2xl font-bold">{metrics.followerGrowth.toFixed(1)}%</p>
              </div>
              <Users className="w-8 h-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Rate Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Taxa de Engajamento</CardTitle>
            <CardDescription>Evolução da taxa de engajamento ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[250px]">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-blue-600">
                            Engajamento: {payload[0].value}%
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="engagementRate"
                  stroke="hsl(220, 91%, 60%)"
                  fill="hsl(220, 91%, 60%)"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Follower Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crescimento de Seguidores</CardTitle>
            <CardDescription>Percentual de crescimento por período</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[250px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-green-600">
                            Crescimento: {payload[0].value}%
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="followerGrowth"
                  fill="hsl(142, 71%, 45%)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Likes per Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance de Conteúdo</CardTitle>
            <CardDescription>Média de curtidas por vídeo</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[250px]">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-purple-600">
                            Likes/vídeo: {formatNumber(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="likesPerVideo"
                  stroke="hsl(261, 83%, 58%)"
                  strokeWidth={3}
                  dot={{ fill: "hsl(261, 83%, 58%)", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Current Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Totais Atuais</CardTitle>
            <CardDescription>Métricas totais da conta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total de Seguidores</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatNumber(metrics.totalFollowers)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total de Curtidas</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatNumber(metrics.totalLikes)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total de Vídeos</span>
                <span className="text-2xl font-bold text-purple-600">
                  {formatNumber(metrics.totalVideos)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}