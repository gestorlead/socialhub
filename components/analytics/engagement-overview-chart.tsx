"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatNumber } from '@/lib/utils'

interface EngagementOverviewChartProps {
  data: {
    followers: { current: number; change: number; changePercent: number }
    likes: { current: number; change: number; changePercent: number }
    videos: { current: number; change: number; changePercent: number }
    following: { current: number; change: number; changePercent: number }
  } | null
  loading?: boolean
}

const chartConfig = {
  followers: {
    label: "Seguidores",
    color: "hsl(var(--chart-1))",
  },
  likes: {
    label: "Curtidas",
    color: "hsl(var(--chart-2))",
  },
  videos: {
    label: "Vídeos",
    color: "hsl(var(--chart-3))",
  },
  following: {
    label: "Seguindo",
    color: "hsl(var(--chart-4))",
  },
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
]

export function EngagementOverviewChart({ data, loading }: EngagementOverviewChartProps) {
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
          <p className="text-sm">Conecte sua conta para ver as métricas</p>
        </div>
      </div>
    )
  }

  // Normalize data for better visualization
  const maxValue = Math.max(
    data.followers.current,
    data.likes.current / 100, // Scale down likes
    data.videos.current * 1000, // Scale up videos
    data.following.current
  )

  const chartData = [
    {
      name: "Seguidores",
      value: data.followers.current,
      displayValue: data.followers.current,
      color: COLORS[0],
    },
    {
      name: "Curtidas (x100)",
      value: Math.max(1, data.likes.current / 100),
      displayValue: data.likes.current,
      color: COLORS[1],
    },
    {
      name: "Vídeos (x1000)",
      value: Math.max(1, data.videos.current * 1000),
      displayValue: data.videos.current,
      color: COLORS[2],
    },
    {
      name: "Seguindo",
      value: data.following.current,
      displayValue: data.following.current,
      color: COLORS[3],
    },
  ].filter(item => item.displayValue > 0)

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig} className="h-[200px]">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => [
                  formatNumber(props.payload.displayValue),
                  props.payload.name.replace(/ \(x\d+\)/, '')
                ]}
              />
            }
          />
        </PieChart>
      </ChartContainer>
      
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate">
              {item.name.replace(/ \(x\d+\)/, '')}
            </span>
            <span className="font-medium ml-auto">
              {formatNumber(item.displayValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}