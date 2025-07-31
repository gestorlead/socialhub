import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown, Users, Eye, Heart } from "lucide-react"
import { formatNumber } from "@/lib/utils"

interface InstagramGrowthData {
  date: string
  followers: number
  impressions: number
  reach: number
  engagement: number
}

interface InstagramGrowthChartProps {
  data: InstagramGrowthData[]
  loading: boolean
  period: string
}

const chartConfig = {
  followers: {
    label: "Seguidores",
    color: "hsl(220, 91%, 60%)", // Azul vibrante (mesmo do TikTok)
  },
  impressions: {
    label: "Impressões",
    color: "hsl(180, 100%, 40%)", // Ciano escuro (mesmo do TikTok)
  },
  reach: {
    label: "Alcance",
    color: "hsl(260, 100%, 60%)", // Roxo-azul vibrante (mesmo do TikTok)
  },
  engagement: {
    label: "Engajamento",
    color: "hsl(210, 100%, 50%)", // Azul puro (mesmo do TikTok)
  },
}

function generateMockGrowthData(period: string, currentStats: any): InstagramGrowthData[] {
  const periods = {
    '7d': 7,
    '30d': 30,
    '60d': 60,
    '90d': 90
  }
  
  const days = periods[period as keyof typeof periods] || 30
  const data: InstagramGrowthData[] = []
  
  const baseFollowers = currentStats?.followers_count || 1000
  const baseImpressions = Math.floor(baseFollowers * 1.2)
  const baseReach = Math.floor(baseFollowers * 0.6)
  const baseEngagement = Math.floor(baseFollowers * 0.05)
  
  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    
    // Generate growth trend with some randomness
    const progress = (days - i) / days
    const growth = progress * 0.1 // 10% growth over period
    const variance = (Math.random() - 0.5) * 0.02 // ±1% daily variance
    
    const followers = Math.floor(baseFollowers * (1 + growth + variance))
    const impressions = Math.floor(baseImpressions * (1 + growth + variance * 2))
    const reach = Math.floor(baseReach * (1 + growth + variance * 1.5))
    const engagement = Math.floor(baseEngagement * (1 + growth + variance * 3))
    
    data.push({
      date: date.toISOString().split('T')[0],
      followers: Math.max(0, followers),
      impressions: Math.max(0, impressions),
      reach: Math.max(0, reach),
      engagement: Math.max(0, engagement)
    })
  }
  
  return data
}

export function InstagramGrowthChart({ data, loading, period }: InstagramGrowthChartProps) {
  // Use real data if available, otherwise generate mock data
  const chartData = data.length > 0 ? data : generateMockGrowthData(period, { followers_count: 1000 })

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Crescimento de Seguidores
            </CardTitle>
            <CardDescription>Carregando dados...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    })
  }


  const calculateGrowth = (data: InstagramGrowthData[], key: keyof InstagramGrowthData) => {
    if (data.length < 2) return 0
    const first = data[0][key] as number
    const last = data[data.length - 1][key] as number
    return first > 0 ? ((last - first) / first) * 100 : 0
  }

  const followersGrowth = calculateGrowth(chartData, 'followers')
  const impressionsGrowth = calculateGrowth(chartData, 'impressions')
  const reachGrowth = calculateGrowth(chartData, 'reach')
  const engagementGrowth = calculateGrowth(chartData, 'engagement')

  return (
    <div className="space-y-6">
      {/* Growth Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Seguidores</p>
                <div className="flex items-center gap-1 mt-1">
                  {followersGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    followersGrowth >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {followersGrowth >= 0 ? '+' : ''}{followersGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Impressões</p>
                <div className="flex items-center gap-1 mt-1">
                  {impressionsGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    impressionsGrowth >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {impressionsGrowth >= 0 ? '+' : ''}{impressionsGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Eye className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alcance</p>
                <div className="flex items-center gap-1 mt-1">
                  {reachGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    reachGrowth >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {reachGrowth >= 0 ? '+' : ''}{reachGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engajamento</p>
                <div className="flex items-center gap-1 mt-1">
                  {engagementGrowth >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    engagementGrowth >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {engagementGrowth >= 0 ? '+' : ''}{engagementGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Heart className="w-8 h-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Followers Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Crescimento de Seguidores
          </CardTitle>
          <CardDescription>
            Evolução do número de seguidores nos últimos {period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : period === '60d' ? '60 dias' : '90 dias'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart 
              data={chartData}
              width="100%"
              height="100%"
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="followers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-followers)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-followers)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
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
                content={<ChartTooltipContent />}
                labelFormatter={(date) => `Data: ${formatDate(date)}`}
              />
              <Area 
                type="monotone" 
                dataKey="followers" 
                stroke="var(--color-followers)" 
                fillOpacity={1} 
                fill="url(#followers)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Impressions & Reach Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Impressões vs Alcance
          </CardTitle>
          <CardDescription>
            Comparação entre impressões totais e alcance único
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart 
              data={chartData}
              width="100%"
              height="100%"
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
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
                content={<ChartTooltipContent />}
                labelFormatter={(date) => `Data: ${formatDate(date)}`}
              />
              <Line 
                type="monotone" 
                dataKey="impressions" 
                stroke="var(--color-impressions)" 
                strokeWidth={2}
                dot={{ fill: 'var(--color-impressions)', strokeWidth: 2, r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="reach" 
                stroke="var(--color-reach)" 
                strokeWidth={2}
                dot={{ fill: 'var(--color-reach)', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}