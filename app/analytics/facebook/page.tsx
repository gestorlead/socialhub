"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useFacebookInsights } from "@/hooks/use-facebook-insights"
import { useFacebookPostsV2 } from "@/hooks/use-facebook-posts-v2"
import { FacebookMetricsDashboard } from "@/components/facebook/FacebookMetricsDashboard"
import { FacebookDemographics } from "@/components/facebook/FacebookDemographics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { 
  Download,
  Facebook,
  AlertTriangle,
  RefreshCw
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"


type Period = '7d' | '30d' | '60d' | '90d'

export default function FacebookAnalyticsPage() {
  const { loading } = useAuth()
  const { getConnection, refresh } = useSocialConnections()
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  const [refreshing, setRefreshing] = useState(false)
  
  const facebookConnection = getConnection('facebook')
  const profile = facebookConnection?.profile_data
  const selectedPageFromProfile = profile?.selected_page
  const selectedPageIdFromProfile = profile?.selected_page_id
  
  // Use the selected page from profile
  useEffect(() => {
    if (selectedPageIdFromProfile) {
      setSelectedPageId(selectedPageIdFromProfile)
    }
  }, [selectedPageIdFromProfile])

  const selectedPage = selectedPageFromProfile

  // Use the Facebook Insights hook
  const { 
    loading: insightsLoading, 
    error: insightsError,
    refetch: refetchInsights
  } = useFacebookInsights(selectedPageId, selectedPeriod)

  // Use the Facebook Posts hook v2 (deprecated-free)
  const { 
    posts: postsData,
    error: postsError,
    refetch: refetchPosts
  } = useFacebookPostsV2(selectedPageId)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refetchInsights(),
        refetchPosts(),
        refresh()
      ])
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
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

  if (!facebookConnection) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <Facebook className="w-16 h-16 mx-auto text-[#1877f2] mb-4" />
            <h2 className="text-2xl font-bold mb-4">Facebook Analytics</h2>
            <p className="text-muted-foreground mb-6">
              Conecte suas páginas do Facebook para visualizar análises de performance
            </p>
            <Button asChild>
              <a href="/networks/facebook">Conectar Facebook</a>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!selectedPage) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">Nenhuma página selecionada</h2>
            <p className="text-muted-foreground mb-6">
              Você precisa selecionar uma página do Facebook para visualizar as análises.
            </p>
            <Button asChild>
              <a href="/networks/facebook">Gerenciar Facebook</a>
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
              Acompanhe o crescimento e performance das suas páginas no Facebook
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
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Current Page Info */}
        {selectedPage && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Facebook className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Analisando:</strong> {selectedPage.name} - {selectedPage.category}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {(insightsError || postsError) && (
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {insightsError || postsError}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Analytics Content */}
        {selectedPageId && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="demographics">Demografia</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <FacebookMetricsDashboard 
                pageId={selectedPageId} 
                pageName={selectedPage?.name || 'Página do Facebook'} 
              />
            </TabsContent>

            <TabsContent value="demographics" className="space-y-4">
              <FacebookDemographics pageId={selectedPageId} />
            </TabsContent>

            <TabsContent value="posts" className="space-y-4">
              {/* Posts content - API v23.0 compatible */}
              {postsData && postsData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Posts Recentes</CardTitle>
                    <CardDescription>
                      Últimos posts publicados na página (dados limitados pela API v23.0)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {postsData.map((post) => (
                        <div key={post.id} className="border rounded-lg p-4">
                          <p className="text-sm mb-2">{post.message || 'Post sem texto'}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>🗓️ {new Date(post.created_time).toLocaleDateString('pt-BR')}</span>
                            <span>🔗 {post.id}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            * Métricas de engajamento não disponíveis na API v23.0
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

      </div>
    </DashboardLayout>
  )
}