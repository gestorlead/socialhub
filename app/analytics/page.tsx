"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { 
  BarChart3,
  TrendingUp,
  Users,
  Play,
  Calendar,
  ExternalLink,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const { getConnection, isConnected } = useSocialConnections()

  const tiktokConnection = getConnection('tiktok')

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
              Acompanhe o desempenho de todas as suas redes sociais em um só lugar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Relatório Mensal
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redes Conectadas</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {[isConnected('tiktok')].filter(Boolean).length}
              </div>
              <p className="text-xs text-muted-foreground">
                de 6 redes disponíveis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Seguidores Totais</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tiktokConnection?.profile_data?.follower_count?.toLocaleString('pt-BR') || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                across all platforms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conteúdos Publicados</CardTitle>
              <Play className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tiktokConnection?.profile_data?.video_count || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engajamento Médio</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tiktokConnection?.profile_data?.follower_count > 0 
                  ? ((tiktokConnection.profile_data.likes_count / tiktokConnection.profile_data.follower_count) * 100).toFixed(1)
                  : '0'
                }%
              </div>
              <p className="text-xs text-muted-foreground">
                taxa de engajamento
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Social Media Analytics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* TikTok Analytics */}
          {isConnected('tiktok') ? (
            <Card className="group hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                      <Image 
                        src="/images/social-icons/tiktok.png" 
                        alt="TikTok" 
                        width={24} 
                        height={24}
                        className="brightness-0 invert"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-lg">TikTok</CardTitle>
                      <CardDescription>
                        @{tiktokConnection?.profile_data?.username || 'username'}
                      </CardDescription>
                    </div>
                  </div>
                  <Link
                    href="/analytics/tiktok"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Seguidores</span>
                    <span className="font-medium">
                      {tiktokConnection?.profile_data?.follower_count?.toLocaleString('pt-BR') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Curtidas</span>
                    <span className="font-medium">
                      {tiktokConnection?.profile_data?.likes_count?.toLocaleString('pt-BR') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vídeos</span>
                    <span className="font-medium">
                      {tiktokConnection?.profile_data?.video_count || '0'}
                    </span>
                  </div>
                </div>
                <Link href="/analytics/tiktok" className="block mt-4">
                  <Button className="w-full" variant="outline">
                    Ver Análise Completa
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Image 
                      src="/images/social-icons/tiktok.png" 
                      alt="TikTok" 
                      width={24} 
                      height={24}
                      className="opacity-50"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-muted-foreground">TikTok</CardTitle>
                    <CardDescription>Não conectado</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Conecte sua conta do TikTok para ver análises detalhadas
                </p>
                <Link href="/networks/tiktok">
                  <Button className="w-full" variant="outline">
                    Conectar TikTok
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Instagram - Coming Soon */}
          <Card className="border-dashed opacity-60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">IG</span>
                </div>
                <div>
                  <CardTitle className="text-lg text-muted-foreground">Instagram</CardTitle>
                  <CardDescription>Em breve</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Análises do Instagram estarão disponíveis em breve
              </p>
              <Button className="w-full" variant="outline" disabled>
                Em Desenvolvimento
              </Button>
            </CardContent>
          </Card>

          {/* Facebook - Coming Soon */}
          <Card className="border-dashed opacity-60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">FB</span>
                </div>
                <div>
                  <CardTitle className="text-lg text-muted-foreground">Facebook</CardTitle>
                  <CardDescription>Em breve</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Análises do Facebook estarão disponíveis em breve
              </p>
              <Button className="w-full" variant="outline" disabled>
                Em Desenvolvimento
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Insights Rápidos</CardTitle>
            <CardDescription>
              Resumo das principais métricas das suas redes sociais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected('tiktok') ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                      <Image 
                        src="/images/social-icons/tiktok.png" 
                        alt="TikTok" 
                        width={16} 
                        height={16}
                        className="brightness-0 invert"
                      />
                    </div>
                    <div>
                      <p className="font-medium">TikTok Performance</p>
                      <p className="text-sm text-muted-foreground">
                        {tiktokConnection?.profile_data?.follower_count > 0 
                          ? `${((tiktokConnection.profile_data.likes_count / tiktokConnection.profile_data.follower_count) * 100).toFixed(1)}% de engajamento`
                          : 'Sem dados de engajamento'
                        }
                      </p>
                    </div>
                  </div>
                  <Link href="/analytics/tiktok">
                    <Button variant="ghost" size="sm">
                      Ver Detalhes
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Conecte suas redes sociais para ver insights personalizados
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}