"use client"

import { ComposedChart, Line, Bar, ResponsiveContainer, XAxis, YAxis, Legend } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { DailyStats } from '@/hooks/use-analytics-data'
import { formatNumber } from '@/lib/utils'

interface MultiMetricChartProps {
  data: DailyStats[]
  loading?: boolean
}

const chartConfig = {
  follower_count: {
    label: "Seguidores",
    color: "hsl(var(--chart-1))",
  },
  likes_count: {
    label: "Curtidas (x1000)",
    color: "hsl(var(--chart-2))",
  },
  video_count: {
    label: "Vídeos (x100)",
    color: "hsl(var(--chart-3))",
  },
  engagement_rate: {
    label: "Taxa Eng. (%)",
    color: "hsl(var(--chart-4))",
  },
}

export function MultiMetricChart({ data, loading }: MultiMetricChartProps) {
  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="mb-2">Dados de engajamento não disponíveis</p>
          <p className="text-sm">Aguarde coleta de dados para ver métricas detalhadas</p>
        </div>
      </div>
    )
  }

  // Format data for chart
  const chartData = data.map(item => {
    const engagementRate = item.follower_count > 0 
      ? (item.likes_count / item.follower_count) * 100 
      : 0

    return {
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        month: 'short', 
        day: 'numeric' 
      }),
      followers: item.follower_count,
      likes_scaled: Math.round(item.likes_count / 1000), // Scale down for better visualization
      videos_scaled: item.video_count * 100, // Scale up for better visualization
      engagement_rate: Number(engagementRate.toFixed(2)),
      // Keep original values for tooltips
      original_likes: item.likes_count,
      original_videos: item.video_count,
    }
  })

  return (
    <ChartContainer config={chartConfig} className="h-[400px]">
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          yAxisId="left"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `Data: ${label}`}
              formatter={(value, name, props) => {
                switch (name) {
                  case 'followers':
                    return [formatNumber(Number(value)), 'Seguidores']
                  case 'likes_scaled':
                    return [formatNumber(props.payload.original_likes), 'Curtidas']
                  case 'videos_scaled':
                    return [props.payload.original_videos, 'Vídeos']
                  case 'engagement_rate':
                    return [`${Number(value).toFixed(2)}%`, 'Taxa de Engajamento']
                  default:
                    return [String(value), String(name)]
                }
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        
        {/* Bars for followers and scaled metrics */}
        <Bar
          yAxisId="left"
          dataKey="followers"
          fill="hsl(var(--chart-1))"
          radius={[2, 2, 0, 0]}
          maxBarSize={15}
        />
        <Bar
          yAxisId="left"
          dataKey="likes_scaled"
          fill="hsl(var(--chart-2))"
          radius={[2, 2, 0, 0]}
          maxBarSize={15}
        />
        <Bar
          yAxisId="left"
          dataKey="videos_scaled"
          fill="hsl(var(--chart-3))"
          radius={[2, 2, 0, 0]}
          maxBarSize={15}
        />
        
        {/* Line for engagement rate */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="engagement_rate"
          stroke="hsl(var(--chart-4))"
          strokeWidth={3}
          dot={{
            fill: "hsl(var(--chart-4))",
            strokeWidth: 2,
            r: 4,
          }}
          activeDot={{
            r: 6,
            stroke: "hsl(var(--chart-4))",
            strokeWidth: 2,
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}