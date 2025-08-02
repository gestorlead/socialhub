"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { 
  Users, 
  Eye, 
  ThumbsUp, 
  Video, 
  TrendingUp, 
  TrendingDown,
  Share,
  Target,
  Activity,
  BarChart3,
  RefreshCw
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { useFacebookDailyStats, type SummaryMetrics, type TrendMetrics } from "@/hooks/use-facebook-daily-stats"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'

interface FacebookMetricsDashboardProps {
  pageId: string
  pageName: string
}

interface MetricCardProps {
  title: string
  value: number | string
  change?: number
  icon: React.ReactNode
  color: string
  subtitle?: string
}

function MetricCard({ title, value, change, icon, color, subtitle }: MetricCardProps) {
  const isPositive = change !== undefined ? change >= 0 : null
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {change !== undefined && (
          <div className={`flex items-center text-xs mt-1 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(change).toFixed(1)}% vs anterior
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function FacebookMetricsDashboard({ pageId, pageName }: FacebookMetricsDashboardProps) {
  const [period, setPeriod] = useState<30 | 60 | 90>(30)
  const { 
    data, 
    summary, 
    trends, 
    loading, 
    error, 
    refetch 
  } = useFacebookDailyStats({ pageId, days: period })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Carregando métricas do Facebook...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 mb-4">Erro ao carregar dados: {error}</p>
        <Button onClick={refetch} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!summary || !data.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum dado disponível para este período</p>
        <p className="text-sm mt-2">Os dados serão coletados automaticamente em breve</p>
      </div>
    )
  }

  // Prepare chart data - Updated for API v23.0 supported metrics
  const chartData = data.map(stat => ({
    date: new Date(stat.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    // Use supported metrics only
    impressions_unique: stat.page_impressions_unique || 0,
    impressions_paid: stat.page_impressions_paid || 0,
    video_ad_impressions: stat.page_daily_video_ad_break_ad_impressions_by_crosspost_status || 0,
    total_video_ad_impressions: stat.total_video_ad_break_ad_impressions || 0,
    // Legacy metrics (will be 0 but kept for backward compatibility)
    fans: stat.page_fans || 0,
    impressions: stat.page_impressions || 0,
    reach: stat.page_reach || 0,
    engagements: stat.page_post_engagements || 0,
    videoViews: stat.page_video_views || 0,
    fanAdds: stat.page_fan_adds || 0,
    fanRemoves: stat.page_fan_removes || 0
  })).reverse() // Reverse to show chronological order

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Análise do Facebook</h2>
          <p className="text-muted-foreground">{pageName}</p>
        </div>
        <div className="flex gap-2">
          <Select value={period.toString()} onValueChange={(value) => setPeriod(Number(value) as 30 | 60 | 90)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics - Updated for API v23.0 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Impressões Únicas"
          value={formatNumber(summary.total_impressions_unique || 0)}
          change={trends?.impressions_unique_trend}
          icon={<Eye className="w-4 h-4 text-blue-600" />}
          color="bg-blue-100"
          subtitle={`${formatNumber(summary.avg_daily_impressions_unique || 0)}/dia em média`}
        />
        <MetricCard
          title="Impressões Pagas"
          value={formatNumber(summary.total_impressions_paid || 0)}
          change={trends?.impressions_paid_trend}
          icon={<Target className="w-4 h-4 text-green-600" />}
          color="bg-green-100"
          subtitle={`${formatNumber(summary.avg_daily_impressions_paid || 0)}/dia em média`}
        />
        <MetricCard
          title="Anúncios em Vídeos"
          value={formatNumber(summary.total_video_ad_impressions || 0)}
          change={trends?.video_ad_impressions_trend}
          icon={<Video className="w-4 h-4 text-purple-600" />}
          color="bg-purple-100"
          subtitle={`${formatNumber(summary.avg_daily_video_ad_impressions || 0)}/dia em média`}
        />
        <MetricCard
          title="Total Anúncios Vídeo"
          value={formatNumber(summary.total_crosspost_video_ads || 0)}
          change={trends?.total_video_ad_impressions_trend}
          icon={<Share className="w-4 h-4 text-orange-600" />}
          color="bg-orange-100"
          subtitle="Incluindo crosspost"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Visualizações de Vídeo"
          value={formatNumber(summary.total_video_views)}
          change={trends?.video_views_trend}
          icon={<Video className="w-4 h-4 text-red-600" />}
          color="bg-red-100"
          subtitle={`${formatNumber(summary.avg_daily_video_views)}/dia em média`}
        />
        <MetricCard
          title="Período Analisado"
          value={`${summary.period_days} dias`}
          icon={<Activity className="w-4 h-4 text-gray-600" />}
          color="bg-gray-100"
          subtitle="Dados coletados automaticamente"
        />
        <MetricCard
          title="Engajamento Médio"
          value={formatNumber(summary.avg_daily_engagements)}
          icon={<BarChart3 className="w-4 h-4 text-indigo-600" />}
          color="bg-indigo-100"
          subtitle="Por dia"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="growth" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="growth">Crescimento</TabsTrigger>
          <TabsTrigger value="reach">Alcance</TabsTrigger>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="video">Vídeos</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crescimento de Seguidores</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [formatNumber(Number(value)), name === 'fans' ? 'Seguidores' : name]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="fans" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Novos Seguidores</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="fanAdds" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seguidores Perdidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="fanRemoves" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reach">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Impressões Únicas vs Pagas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="impressions_unique" 
                      stroke="#3b82f6" 
                      name="Impressões Únicas"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="impressions_paid" 
                      stroke="#10b981" 
                      name="Impressões Pagas"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendência de Impressões Únicas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="impressions_unique" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>Engajamento ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="engagements" 
                    stroke="#f97316" 
                    fill="#f97316" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Anúncios em Vídeos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="video_ad_impressions" fill="#8b5cf6" name="Anúncios em Vídeos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total de Anúncios (Crosspost)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total_video_ad_impressions" fill="#f97316" name="Total Anúncios" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}