"use client"

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { DailyStats } from '@/hooks/use-analytics-data'
import { formatNumber } from '@/lib/utils'

interface FollowersGrowthChartProps {
  data: DailyStats[]
  period: string
  loading?: boolean
}

const chartConfig = {
  follower_count: {
    label: "Seguidores",
    color: "hsl(var(--chart-1))",
  },
}

export function FollowersGrowthChart({ data, period, loading }: FollowersGrowthChartProps) {
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
          <p className="mb-2">Nenhum dado histórico disponível</p>
          <p className="text-sm">Os dados aparecerão após a primeira coleta automática</p>
        </div>
      </div>
    )
  }

  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    }),
    followers: item.follower_count
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <LineChart data={chartData}>
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `Data: ${label}`}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                'Seguidores'
              ]}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="followers"
          stroke="var(--color-follower_count)"
          strokeWidth={2}
          dot={{
            fill: "var(--color-follower_count)",
            strokeWidth: 2,
            r: 4,
          }}
          activeDot={{
            r: 6,
            stroke: "var(--color-follower_count)",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ChartContainer>
  )
}