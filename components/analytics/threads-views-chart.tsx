"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatNumber } from '@/lib/utils'

interface ViewsData {
  end_time: string
  value: number
}

interface ThreadsViewsChartProps {
  data: ViewsData[]
  loading?: boolean
  height?: number
}

const chartConfig = {
  views: {
    label: "Visualizações",
    color: "hsl(200, 91%, 60%)", // Cyan para combinar com Threads
  },
}

export function ThreadsViewsChart({ data, loading, height = 300 }: ThreadsViewsChartProps) {
  if (loading) {
    return (
      <div className={`h-[${height}px] flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`h-[${height}px] flex items-center justify-center text-muted-foreground`}>
        <div className="text-center">
          <p className="mb-2">Nenhum dado de views disponível</p>
          <p className="text-sm">Os dados de visualizações aparecerão aqui quando disponíveis via Insights API</p>
        </div>
      </div>
    )
  }

  // Process data for chart
  const chartData = data
    .map(item => ({
      ...item,
      date: new Date(item.end_time).toLocaleDateString('pt-BR', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      }),
      views: item.value,
      fullDate: new Date(item.end_time).toLocaleDateString('pt-BR')
    }))
    .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())

  // Calculate max value for better scaling
  const maxViews = Math.max(...chartData.map(d => d.views))
  const yAxisMax = Math.ceil(maxViews * 1.1)

  return (
    <div className={`h-[${height}px]`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
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
            domain={[0, yAxisMax]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <div className="grid gap-2">
                      <div className="font-medium">{data.fullDate}</div>
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-cyan-500" />
                          <span className="text-sm text-muted-foreground">Visualizações:</span>
                          <span className="font-medium">{formatNumber(data.views)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Line 
            type="monotone" 
            dataKey="views" 
            stroke="hsl(200, 91%, 60%)"
            strokeWidth={3}
            dot={{ 
              fill: "hsl(200, 91%, 60%)", 
              strokeWidth: 2,
              r: 4
            }}
            activeDot={{ 
              r: 6, 
              stroke: "hsl(200, 91%, 60%)",
              strokeWidth: 2,
              fill: "hsl(var(--background))"
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Summary stats component for views
interface ThreadsViewsSummaryProps {
  data: ViewsData[]
  loading?: boolean
}

export function ThreadsViewsSummary({ data, loading }: ThreadsViewsSummaryProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded mb-2"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p>Nenhum dados de views para calcular estatísticas</p>
      </div>
    )
  }

  // Calculate summary statistics
  const totalViews = data.reduce((sum, item) => sum + item.value, 0)
  const averageViews = totalViews / data.length
  const maxViews = Math.max(...data.map(d => d.value))
  const minViews = Math.min(...data.map(d => d.value))

  // Find the day with max views
  const maxViewsDay = data.find(d => d.value === maxViews)
  const maxViewsDate = maxViewsDay 
    ? new Date(maxViewsDay.end_time).toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    : 'N/A'

  // Calculate trend (growth from first to last day)
  const firstDay = data[0]?.value || 0
  const lastDay = data[data.length - 1]?.value || 0
  const trend = firstDay > 0 ? ((lastDay - firstDay) / firstDay) * 100 : 0

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Total de Views</p>
        <p className="text-2xl font-bold">{formatNumber(totalViews)}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Média Diária</p>
        <p className="text-2xl font-bold">{formatNumber(Math.round(averageViews))}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Melhor Dia</p>
        <p className="text-lg font-bold">{formatNumber(maxViews)}</p>
        <p className="text-xs text-muted-foreground">{maxViewsDate}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Tendência</p>
        <p className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}