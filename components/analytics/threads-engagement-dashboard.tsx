"use client"

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from '@/lib/utils'
import { Heart, MessageCircle, Repeat, TrendingUp, Users } from 'lucide-react'

interface EngagementData {
  likes: number
  replies: number
  reposts: number
  quotes?: number
  posts: number
  views: number
}

interface ThreadsEngagementDashboardProps {
  data: EngagementData
  loading?: boolean
}

const COLORS = {
  likes: '#ef4444',    // Red
  replies: '#8b5cf6',  // Purple  
  reposts: '#10b981',  // Green
  quotes: '#f59e0b'    // Amber
}

export function ThreadsEngagementDashboard({ data, loading }: ThreadsEngagementDashboardProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum dado de engajamento disponível</p>
      </div>
    )
  }

  // Calculate totals and rates
  const totalEngagement = data.likes + data.replies + data.reposts + (data.quotes || 0)
  const engagementRate = data.posts > 0 ? (totalEngagement / data.posts) : 0
  const engagementPercentage = data.views > 0 ? (totalEngagement / data.views) * 100 : 0

  // Prepare data for pie chart
  const pieData = [
    { name: 'Curtidas', value: data.likes, color: COLORS.likes, icon: '❤️' },
    { name: 'Respostas', value: data.replies, color: COLORS.replies, icon: '💬' },
    { name: 'Reposts', value: data.reposts, color: COLORS.reposts, icon: '🔄' },
  ].filter(item => item.value > 0)

  // Add quotes if available
  if (data.quotes && data.quotes > 0) {
    pieData.push({ name: 'Quotes', value: data.quotes, color: COLORS.quotes, icon: '💭' })
  }

  // Prepare data for bar chart (engagement per post type)
  const barData = [
    { 
      name: 'Curtidas', 
      total: data.likes,
      perPost: data.posts > 0 ? data.likes / data.posts : 0,
      color: COLORS.likes 
    },
    { 
      name: 'Respostas', 
      total: data.replies,
      perPost: data.posts > 0 ? data.replies / data.posts : 0,
      color: COLORS.replies 
    },
    { 
      name: 'Reposts', 
      total: data.reposts,
      perPost: data.posts > 0 ? data.reposts / data.posts : 0,
      color: COLORS.reposts 
    }
  ]

  return (
    <div className="space-y-6">
      {/* Engagement Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engajamento Total</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalEngagement)}</div>
            <p className="text-xs text-muted-foreground">
              todas as interações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Post</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(engagementRate)}</div>
            <p className="text-xs text-muted-foreground">
              interações por post
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Engajamento</CardTitle>
            <Heart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementPercentage.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              engajamento/views ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Métrica</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.likes >= data.replies && data.likes >= data.reposts ? '❤️' :
               data.replies >= data.likes && data.replies >= data.reposts ? '💬' : '🔄'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.likes >= data.replies && data.likes >= data.reposts ? 'Curtidas' :
               data.replies >= data.likes && data.replies >= data.reposts ? 'Respostas' : 'Reposts'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart - Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Engajamento</CardTitle>
            <CardDescription>
              Como seus seguidores interagem com seu conteúdo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-md">
                              <div className="grid gap-2">
                                <div className="font-medium flex items-center gap-2">
                                  <span>{data.icon}</span>
                                  {data.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatNumber(data.value)} interações
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum dado de engajamento</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Engagement per Post */}
        <Card>
          <CardHeader>
            <CardTitle>Engajamento por Post</CardTitle>
            <CardDescription>
              Média de cada tipo de interação por post publicado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <div className="grid gap-2">
                              <div className="font-medium">{label}</div>
                              <div className="grid gap-1 text-sm">
                                <div>Total: {formatNumber(data.total)}</div>
                                <div>Por post: {formatNumber(data.perPost.toFixed(1))}</div>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar 
                    dataKey="perPost" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada</CardTitle>
          <CardDescription>
            Insights sobre o comportamento de engajamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="font-medium">Curtidas</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatNumber(data.likes)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatNumber((data.likes / totalEngagement * 100).toFixed(1))}% do total
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber((data.posts > 0 ? data.likes / data.posts : 0).toFixed(1))} por post
                </div>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Respostas</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatNumber(data.replies)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatNumber((data.replies / totalEngagement * 100).toFixed(1))}% do total
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber((data.posts > 0 ? data.replies / data.posts : 0).toFixed(1))} por post
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Repeat className="w-5 h-5 text-green-500" />
                <span className="font-medium">Reposts</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatNumber(data.reposts)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatNumber((data.reposts / totalEngagement * 100).toFixed(1))}% do total
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber((data.posts > 0 ? data.reposts / data.posts : 0).toFixed(1))} por post
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}