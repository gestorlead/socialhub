"use client"

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface PerformanceRadarChartProps {
  data: {
    followers: { current: number; change: number; changePercent: number }
    likes: { current: number; change: number; changePercent: number }
    videos: { current: number; change: number; changePercent: number }
    following: { current: number; change: number; changePercent: number }
  } | null
  loading?: boolean
}

const chartConfig = {
  performance: {
    label: "Performance",
    color: "hsl(var(--chart-1))",
  },
}

export function PerformanceRadarChart({ data, loading }: PerformanceRadarChartProps) {
  if (loading) {
    return (
      <div className="h-[250px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="mb-2">Dados não disponíveis</p>
          <p className="text-sm">Performance será calculada com mais dados</p>
        </div>
      </div>
    )
  }

  // Normalize growth percentages to 0-100 scale for radar chart
  const normalizeValue = (changePercent: number): number => {
    // Clamp between -100 and +100, then map to 0-100 scale
    const clamped = Math.max(-100, Math.min(100, changePercent))
    return (clamped + 100) / 2 // Maps -100 to 0, 0 to 50, +100 to 100
  }

  const chartData = [
    {
      metric: "Seguidores",
      performance: normalizeValue(data.followers.changePercent),
      actualPercent: data.followers.changePercent,
    },
    {
      metric: "Curtidas",
      performance: normalizeValue(data.likes.changePercent),
      actualPercent: data.likes.changePercent,
    },
    {
      metric: "Vídeos",
      performance: normalizeValue(data.videos.changePercent),
      actualPercent: data.videos.changePercent,
    },
    {
      metric: "Seguindo",
      performance: normalizeValue(data.following.changePercent),
      actualPercent: data.following.changePercent,
    },
  ]

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig} className="h-[200px]">
        <RadarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fontSize: 12, fill: 'var(--foreground)' }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Performance"
            dataKey="performance"
            stroke="var(--color-performance)"
            fill="var(--color-performance)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => [
                  `${props.payload.actualPercent.toFixed(1)}%`,
                  'Crescimento'
                ]}
                labelFormatter={(label) => `${label}`}
              />
            }
          />
        </RadarChart>
      </ChartContainer>
      
      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item, index) => {
          const isPositive = item.actualPercent >= 0
          return (
            <div key={index} className="flex items-center justify-between">
              <span className="text-muted-foreground">{item.metric}</span>
              <span className={`font-medium ${
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositive ? '+' : ''}{item.actualPercent.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}