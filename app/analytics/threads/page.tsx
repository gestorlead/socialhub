"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useThreadsInsights } from "@/hooks/use-threads-insights"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useMemo } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  MessageCircle, 
  Heart, 
  Edit3, 
  Eye,
  Repeat,
  Download,
  RefreshCw,
  BarChart3,
  LineChart as LineChartIcon,
  Users,
  AlertTriangle
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
  available?: boolean
}

function MetricCard({ title, value, change, changePercent, icon, color, available = true }: MetricCardProps) {
  const isPositive = change !== undefined ? change >= 0 : null
  
  return (
    <Card className={`${!available ? 'opacity-60' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`p-2 rounded-lg ${color} cursor-help`}>
              {icon}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{title} {!available && '(Limitado pela API)'}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{available ? formatNumber(value) : 'N/A'}</div>
        {available && change !== undefined && changePercent !== undefined && (
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
        {!available && (
          <div className="flex items-center text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 mr-1 text-amber-500" />
            <span>Aguardando dados via Insights API</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ThreadsAnalyticsPage() {
  const { user, loading } = useAuth()
  const { getConnection } = useSocialConnections()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  
  // Use the Threads insights hook with period filtering
  const { data: insightsData, loading: insightsLoading, error: insightsError, refetch } = useThreadsInsights(selectedPeriod)
  
  // Get connection for fallback data
  const threadsConnection = getConnection('threads')
  
  // Use insights data if available, otherwise fall back to connection data
  const metrics = insightsData?.metrics
  const profile = insightsData?.profile || threadsConnection?.profile_data
  const engagementRate = insightsData?.engagementRate || 0

  const handleRefresh = async () => {
    await refetch()
  }

  const handlePeriodChange = (newPeriod: Period) => {
    setSelectedPeriod(newPeriod)
    // The useEffect in useThreadsInsights will automatically refetch with new period
  }

  if (loading || insightsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!threadsConnection) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-4">Threads Analytics</h2>
            <p className="text-muted-foreground mb-6">
              Conecte sua conta do Threads para visualizar suas análises de performance
            </p>
            <Button asChild>
              <a href="/networks/threads">Conectar Threads</a>
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
              Acompanhe o crescimento e performance da sua conta no Threads
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRefresh}
              disabled={insightsLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${insightsLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Select
              value={selectedPeriod}
              onValueChange={handlePeriodChange}
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

        {/* Period Info Alert */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <strong>📊 Período Ativo:</strong> Exibindo dados dos {
              selectedPeriod === '7d' ? 'últimos 7 dias' :
              selectedPeriod === '30d' ? 'últimos 30 dias' :
              selectedPeriod === '60d' ? 'últimos 60 dias' :
              'últimos 90 dias'
            } via Threads Insights API com filtros de data.
          </AlertDescription>
        </Alert>

        {/* Metrics Overview */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Posts Publicados"
              value={metrics.posts.current}
              change={metrics.posts.change}
              changePercent={metrics.posts.changePercent}
              icon={<Edit3 className="w-4 h-4 text-white" />}
              color="bg-black"
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
              title="Visualizações"
              value={metrics.views.current}
              change={metrics.views.change}
              changePercent={metrics.views.changePercent}
              icon={<Eye className="w-4 h-4 text-white" />}
              color="bg-cyan-500"
            />
            <MetricCard
              title="Respostas"
              value={metrics.replies.current}
              change={metrics.replies.change}
              changePercent={metrics.replies.changePercent}
              icon={<MessageCircle className="w-4 h-4 text-white" />}
              color="bg-purple-500"
            />
            <MetricCard
              title="Reposts"
              value={metrics.reposts.current}
              change={metrics.reposts.change}
              changePercent={metrics.reposts.changePercent}
              icon={<Repeat className="w-4 h-4 text-white" />}
              color="bg-green-500"
            />
            <MetricCard
              title="Seguidores"
              value={metrics.followers.current}
              change={metrics.followers.change}
              changePercent={metrics.followers.changePercent}
              icon={<Users className="w-4 h-4 text-white" />}
              color="bg-blue-500"
              available={metrics.followers.current > 0}
            />
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Engajamento por Post</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(engagementRate)}</div>
              <p className="text-xs text-muted-foreground">
                média de interações por post
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Views por Post</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(insightsData?.viewsPerPost || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                média de visualizações por post
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Reply</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(insightsData?.replyRate || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                posts que recebem respostas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="engagement">Engajamento</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Profile Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Resumo do Perfil
                </CardTitle>
                <CardDescription>
                  Informações gerais da sua conta do Threads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Nome de usuário</p>
                    <p className="font-medium">@{profile?.username || 'N/A'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{profile?.name || 'N/A'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Verificado</p>
                    <p className="font-medium">
                      {profile?.is_verified ? '✅ Sim' : '❌ Não'}
                    </p>
                  </div>
                </div>

                {profile?.threads_biography && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Biografia</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{profile.threads_biography}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Views per Day Display */}
            {profile?.views_daily && profile.views_daily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="w-5 h-5" />
                    Visualizações por Dia
                  </CardTitle>
                  <CardDescription>
                    Histórico de views dos últimos dias (dados diretos da API)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile.views_daily.slice(0, 7).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm text-muted-foreground">
                          {new Date(item.end_time).toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="font-medium">{formatNumber(item.value)} views</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Engajamento</CardTitle>
                <CardDescription>
                  Breakdown das interações nos seus posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Curtidas</span>
                    </div>
                    <span className="text-lg font-bold">{formatNumber(profile?.insights_likes || 0)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-purple-500" />
                      <span className="font-medium">Respostas</span>
                    </div>
                    <span className="text-lg font-bold">{formatNumber(profile?.insights_replies || 0)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Repeat className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Reposts</span>
                    </div>
                    <span className="text-lg font-bold">{formatNumber(profile?.insights_reposts || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Conteúdo</CardTitle>
                <CardDescription>
                  Análise dos seus posts no Threads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total de Posts</p>
                    <p className="text-2xl font-bold">{formatNumber(profile?.posts_count || 0)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Última Atualização</p>
                    <p className="text-sm">
                      {profile?.last_metrics_update 
                        ? new Date(profile.last_metrics_update).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Publishing Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Insights de Publicação</CardTitle>
                <CardDescription>
                  Dicas baseadas nos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                    <p className="text-sm">
                      📊 <strong>Engajamento médio:</strong> Seus posts recebem em média {formatNumber(engagementRate)} interações
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-lg">
                    <p className="text-sm">
                      👀 <strong>Alcance médio:</strong> Cada post alcança aproximadamente {
                        formatNumber(insightsData?.viewsPerPost || 0)
                      } visualizações
                    </p>
                  </div>
                  {insightsData?.replyRate && insightsData.replyRate > 0 && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                      <p className="text-sm">
                        💬 <strong>Taxa de conversa:</strong> {insightsData.replyRate.toFixed(1)}% dos seus posts geram conversas
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}