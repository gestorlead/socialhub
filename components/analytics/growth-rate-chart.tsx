"use client"

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GrowthData } from '@/hooks/use-analytics-data'

interface GrowthRateChartProps {
  data: GrowthData[]
  loading?: boolean
}

const chartConfig = {
  follower_growth_percent: {
    label: "Seguidores",
    color: "hsl(var(--chart-1))",
  },
  likes_growth_percent: {
    label: "Curtidas",
    color: "hsl(var(--chart-2))",
  },
  video_growth_percent: {
    label: "Vídeos",
    color: "hsl(var(--chart-3))",
  },
}

export function GrowthRateChart({ data, loading }: GrowthRateChartProps) {
  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="mb-2">Dados de crescimento não disponíveis</p>
          <p className="text-sm">Aguarde mais dados para análise de crescimento</p>
        </div>
      </div>
    )
  }

  // Format data for chart - show last 14 days
  const chartData = data.slice(-14).map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    }),
    followers: Number(item.follower_growth_percent.toFixed(1)),
    likes: Number(item.likes_growth_percent.toFixed(1)),
    videos: Number(item.video_growth_percent.toFixed(1)),
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `Data: ${label}`}
              formatter={(value, name) => {
                const labels = {
                  followers: 'Seguidores',
                  likes: 'Curtidas', 
                  videos: 'Vídeos'
                }
                return [
                  `${Number(value).toFixed(1)}%`,
                  labels[name as keyof typeof labels] || name
                ]
              }}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="followers"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="likes"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="videos"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  )
}