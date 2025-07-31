"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Users, Eye, Heart, TrendingUp, Clock, Camera } from "lucide-react"
import { formatNumber } from "@/lib/utils"

interface InstagramAccountInsights {
  impressions: number
  reach: number
  profile_views: number
}

interface InstagramMediaInsight {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  permalink: string
  timestamp: string
  insights: {
    engagement: number
    impressions: number
    reach: number
    likes?: number
    comments?: number
  }
}

interface DailyStats {
  date: string
  follower_count: number
  following_count: number
  media_count: number
  impressions: number
  reach: number
  profile_views: number
}

interface InstagramAudienceInsightsProps {
  accountInsights: InstagramAccountInsights | null
  mediaInsights: InstagramMediaInsight[]
  dailyStats: DailyStats[]
  loading: boolean
  error: string | null
  hasMinimumFollowers: boolean
}

// Cores do gráfico seguindo o padrão do Instagram
const chartConfig = {
  engagement: {
    label: "Engajamento",
    color: "hsl(210, 100%, 50%)",
  },
  impressions: {
    label: "Impressões", 
    color: "hsl(180, 100%, 40%)",
  },
  reach: {
    label: "Alcance",
    color: "hsl(260, 100%, 60%)",
  },
  profile_views: {
    label: "Visualizações do Perfil",
    color: "hsl(220, 91%, 60%)",
  }
}

const COLORS = ['hsl(210, 100%, 50%)', 'hsl(180, 100%, 40%)', 'hsl(260, 100%, 60%)', 'hsl(220, 91%, 60%)']

export function InstagramAudienceInsights({ 
  accountInsights, 
  mediaInsights, 
  dailyStats,
  loading, 
  error, 
  hasMinimumFollowers 
}: InstagramAudienceInsightsProps) {
  
  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="h-40 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!hasMinimumFollowers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Insights de Audiência Indisponíveis
          </CardTitle>
          <CardDescription>
            Dados detalhados de audiência requerem no mínimo 100 seguidores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Alcance 100 seguidores para desbloquear</p>
              <p className="text-sm">insights detalhados da sua audiência</p>
            </div>
          </div>
          {dailyStats.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-4">Dados Básicos Disponíveis</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(dailyStats[dailyStats.length - 1]?.follower_count || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Seguidores</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(dailyStats[dailyStats.length - 1]?.following_count || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Seguindo</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(dailyStats[dailyStats.length - 1]?.media_count || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Users className="w-5 h-5" />
            Erro ao Carregar Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <div className="text-center">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <p className="text-xs">Tente novamente mais tarde</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular métricas de audiência
  const currentStats = dailyStats[dailyStats.length - 1]
  const previousStats = dailyStats[dailyStats.length - 8] // 7 dias atrás
  
  const audienceMetrics = {
    totalFollowers: currentStats?.follower_count || 0,
    followersGrowth: currentStats && previousStats 
      ? currentStats.follower_count - previousStats.follower_count 
      : 0,
    totalReach: accountInsights?.reach || 0,
    totalImpressions: accountInsights?.impressions || 0,
    profileViews: accountInsights?.profile_views || 0,
    engagementRate: mediaInsights.length > 0 
      ? (mediaInsights.reduce((acc, media) => acc + media.insights.engagement, 0) / mediaInsights.length / currentStats?.follower_count * 100) || 0
      : 0
  }

  // Dados para gráfico de tipos de conteúdo
  const contentTypeData = mediaInsights.reduce((acc, media) => {
    const type = media.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 
                 media.media_type === 'VIDEO' ? 'Vídeo' : 'Foto'
    
    const existing = acc.find(item => item.type === type)
    if (existing) {
      existing.count += 1
      existing.totalEngagement += media.insights.engagement
    } else {
      acc.push({
        type,
        count: 1,
        totalEngagement: media.insights.engagement,
        avgEngagement: media.insights.engagement
      })
    }
    return acc
  }, [] as Array<{type: string, count: number, totalEngagement: number, avgEngagement: number}>)

  // Calcular engajamento médio por tipo
  contentTypeData.forEach(item => {
    item.avgEngagement = item.totalEngagement / item.count
  })

  // Dados para gráfico de performance por dia da semana
  const weekdayData = mediaInsights.reduce((acc, media) => {
    const date = new Date(media.timestamp)
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' })
    
    const existing = acc.find(item => item.day === weekday)
    if (existing) {
      existing.posts += 1
      existing.totalEngagement += media.insights.engagement
      existing.totalReach += media.insights.reach
    } else {
      acc.push({
        day: weekday,
        posts: 1,
        totalEngagement: media.insights.engagement,
        avgEngagement: media.insights.engagement,
        totalReach: media.insights.reach,
        avgReach: media.insights.reach
      })
    }
    return acc
  }, [] as Array<{day: string, posts: number, totalEngagement: number, avgEngagement: number, totalReach: number, avgReach: number}>)

  // Calcular médias
  weekdayData.forEach(item => {
    item.avgEngagement = item.totalEngagement / item.posts
    item.avgReach = item.totalReach / item.posts
  })

  // Ordenar por dia da semana
  const weekdayOrder = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  weekdayData.sort((a, b) => weekdayOrder.indexOf(a.day) - weekdayOrder.indexOf(b.day))

  return (
    <div className="space-y-6">
      {/* Métricas Principais de Audiência */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alcance Total</p>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(audienceMetrics.totalReach)}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Impressões Totais</p>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(audienceMetrics.totalImpressions)}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Visualizações do Perfil</p>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(audienceMetrics.profileViews)}
                </div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Engajamento</p>
                <div className="text-2xl font-bold text-primary">
                  {audienceMetrics.engagementRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Média dos posts</p>
              </div>
              <Heart className="w-8 h-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Tipo de Conteúdo */}
      {contentTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Performance por Tipo de Conteúdo
            </CardTitle>
            <CardDescription>
              Engajamento médio por tipo de post publicado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={contentTypeData} width="100%" height={300}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="type"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `Tipo: ${label}`}
                      formatter={(value, name) => [
                        formatNumber(Number(value)),
                        name === 'avgEngagement' ? 'Engajamento Médio' : 
                        name === 'count' ? 'Quantidade de Posts' : name
                      ]}
                    />
                  }
                />
                <Bar 
                  dataKey="avgEngagement" 
                  fill="var(--color-engagement)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Performance por Dia da Semana */}
      {weekdayData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Performance por Dia da Semana
            </CardTitle>
            <CardDescription>
              Alcance médio dos posts por dia da semana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={weekdayData} width="100%" height={300}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `Dia: ${label}`}
                      formatter={(value, name) => [
                        formatNumber(Number(value)),
                        name === 'avgReach' ? 'Alcance Médio' : 
                        name === 'posts' ? 'Posts Publicados' : name
                      ]}
                    />
                  }
                />
                <Bar 
                  dataKey="avgReach" 
                  fill="var(--color-reach)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Distribuição de Tipos de Conteúdo */}
      {contentTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição do Conteúdo</CardTitle>
            <CardDescription>
              Proporção dos tipos de posts publicados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart width="100%" height={300}>
                  <Pie
                    data={contentTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ type, count }) => `${type}: ${count}`}
                  >
                    {contentTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          `${value} posts`,
                          'Quantidade'
                        ]}
                      />
                    }
                  />
                </PieChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo dos Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo dos Insights de Audiência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Alcance e Impressões</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Seu conteúdo alcançou <strong>{formatNumber(audienceMetrics.totalReach)}</strong> pessoas únicas</p>
                <p>• Total de <strong>{formatNumber(audienceMetrics.totalImpressions)}</strong> impressões geradas</p>
                <p>• Taxa de alcance: <strong>{audienceMetrics.totalReach > 0 && currentStats ? (audienceMetrics.totalReach / currentStats.follower_count * 100).toFixed(1) : 0}%</strong> dos seguidores</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Engajamento</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Taxa média de engajamento: <strong>{audienceMetrics.engagementRate.toFixed(1)}%</strong></p>
                <p>• <strong>{formatNumber(audienceMetrics.profileViews)}</strong> visualizações do perfil</p>
                <p>• <strong>{mediaInsights.length}</strong> posts analisados no período</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}