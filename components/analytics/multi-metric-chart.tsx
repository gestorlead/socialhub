"use client"

import { ComposedChart, Line, Bar, ResponsiveContainer, XAxis, YAxis, Legend } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { DailyStats } from '@/hooks/use-analytics-data'
import { formatNumber } from '@/lib/utils'
import { useMemo, useCallback } from 'react'

// Chart configuration constants
const CHART_CONSTANTS = {
  LIKES_SCALE_FACTOR: 1000,
  VIDEOS_SCALE_FACTOR: 100,
  CHART_HEIGHT: 400,
  MAX_BAR_SIZE: 15,
  STROKE_WIDTH: 3,
  DOT_RADIUS: 4,
  ACTIVE_DOT_RADIUS: 6
} as const

const CHART_MARGINS = {
  top: 20,
  right: 30,
  left: 20,
  bottom: 5
} as const

// TypeScript interfaces
interface ChartDataPoint {
  date: string
  follower_count: number
  likes_count: number
  video_count: number
  engagement_rate: number
  original_likes: number
  original_videos: number
}

interface FormattedMetric {
  value: number
  displayValue: string
  unit: string
}

interface MultiMetricChartProps {
  data: DailyStats[]
  loading?: boolean
}

// Utility functions
/**
 * Formats a metric value with appropriate scaling and units
 * @param value - Raw numeric value
 * @param scaleFactor - Factor to scale the value by
 * @returns Formatted metric with value, display value, and unit
 */
const formatMetricValue = (value: number, scaleFactor: number): FormattedMetric => {
  const scaledValue = scaleFactor === 1 ? value : Math.round(value / scaleFactor)
  return {
    value: scaledValue,
    displayValue: formatNumber(scaledValue),
    unit: scaleFactor === 1000 ? 'K' : scaleFactor === 100 ? '×100' : ''
  }
}

/**
 * Calculates engagement rate as a percentage of likes to followers
 * @param likes - Total number of likes
 * @param followers - Total number of followers
 * @returns Engagement rate as a percentage (0-100)
 */
const calculateEngagementRate = (likes: number, followers: number): number => {
  return followers > 0 ? Number(((likes / followers) * 100).toFixed(2)) : 0
}

/**
 * Formats date string for chart display
 * @param dateString - ISO date string
 * @returns Formatted date string in Portuguese locale
 */
const formatChartDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return dateString
  }
}

const chartConfig = {
  follower_count: {
    label: "Seguidores",
    color: "hsl(220, 91%, 60%)",
  },
  likes_count: {
    label: `Curtidas (÷${CHART_CONSTANTS.LIKES_SCALE_FACTOR})`,
    color: "hsl(200, 85%, 55%)",
  },
  video_count: {
    label: `Vídeos (×${CHART_CONSTANTS.VIDEOS_SCALE_FACTOR})`,
    color: "hsl(240, 80%, 65%)",
  },
  engagement_rate: {
    label: "Taxa Eng. (%)",
    color: "hsl(210, 70%, 50%)",
  },
}

/**
 * Multi-Metric Chart Component
 * 
 * Displays engagement metrics including followers, likes, videos, and engagement rate
 * over time using a combination of bar charts and line charts.
 * 
 * Features:
 * - Responsive design with accessibility support
 * - Automatic scaling for better visualization
 * - Memoized data transformation for performance
 * - Interactive tooltips with detailed information
 * - Error handling and graceful degradation
 * 
 * @param data - Array of daily statistics
 * @param loading - Loading state indicator
 */
export function MultiMetricChart({ data, loading }: MultiMetricChartProps) {
  // Memoized tooltip formatter for performance
  const tooltipFormatter = useCallback((value: unknown, name: string, props: { payload: ChartDataPoint }) => {
    try {
      switch (name) {
        case 'follower_count':
          return [formatNumber(Number(value)), 'Seguidores']
        case 'likes_count':
          return [formatNumber(props.payload.original_likes), 'Curtidas']
        case 'video_count':
          return [props.payload.original_videos, 'Vídeos']
        case 'engagement_rate':
          return [`${Number(value).toFixed(2)}%`, 'Taxa de Engajamento']
        default:
          return [String(value), String(name)]
      }
    } catch {
      return [String(value), String(name)]
    }
  }, [])

  // Memoized data transformation for performance - moved before early returns
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    try {
      return data.map((item): ChartDataPoint => {
        const engagementRate = calculateEngagementRate(item.likes_count, item.follower_count)
        
        return {
          date: formatChartDate(item.date),
          follower_count: item.follower_count,
          likes_count: formatMetricValue(item.likes_count, CHART_CONSTANTS.LIKES_SCALE_FACTOR).value,
          video_count: item.video_count * CHART_CONSTANTS.VIDEOS_SCALE_FACTOR,
          engagement_rate: engagementRate,
          // Keep original values for tooltips
          original_likes: item.likes_count,
          original_videos: item.video_count,
        }
      })
    } catch (error) {
      console.error('Error transforming chart data:', error)
      return []
    }
  }, [data])

  if (loading) {
    return (
      <div 
        className="h-[400px] flex items-center justify-center"
        role="status"
        aria-label="Carregando gráfico de métricas"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="h-[400px] flex items-center justify-center text-muted-foreground"
        role="img"
        aria-label="Dados não disponíveis"
      >
        <div className="text-center">
          <p className="mb-2">Dados de engajamento não disponíveis</p>
          <p className="text-sm">Aguarde coleta de dados para ver métricas detalhadas</p>
        </div>
      </div>
    )
  }

  return (
    <ChartContainer 
      config={chartConfig} 
      className={`h-[${CHART_CONSTANTS.CHART_HEIGHT}px]`}
    >
      <ComposedChart 
        data={chartData} 
        margin={CHART_MARGINS}
        role="img"
        aria-label="Gráfico de métricas de engajamento mostrando seguidores, curtidas, vídeos e taxa de engajamento ao longo do tempo"
      >
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
              formatter={tooltipFormatter}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        
        {/* Bars for followers and scaled metrics */}
        <Bar
          yAxisId="left"
          dataKey="follower_count"
          fill="var(--color-follower_count)"
          radius={[2, 2, 0, 0]}
          maxBarSize={CHART_CONSTANTS.MAX_BAR_SIZE}
          aria-label="Seguidores por período"
        />
        <Bar
          yAxisId="left"
          dataKey="likes_count"
          fill="var(--color-likes_count)"
          radius={[2, 2, 0, 0]}
          maxBarSize={CHART_CONSTANTS.MAX_BAR_SIZE}
          aria-label="Curtidas por período (escala reduzida)"
        />
        <Bar
          yAxisId="left"
          dataKey="video_count"
          fill="var(--color-video_count)"
          radius={[2, 2, 0, 0]}
          maxBarSize={CHART_CONSTANTS.MAX_BAR_SIZE}
          aria-label="Vídeos por período (escala ampliada)"
        />
        
        {/* Line for engagement rate */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="engagement_rate"
          stroke="var(--color-engagement_rate)"
          strokeWidth={CHART_CONSTANTS.STROKE_WIDTH}
          dot={{
            fill: "var(--color-engagement_rate)",
            strokeWidth: 2,
            r: CHART_CONSTANTS.DOT_RADIUS,
          }}
          activeDot={{
            r: CHART_CONSTANTS.ACTIVE_DOT_RADIUS,
            stroke: "var(--color-engagement_rate)",
            strokeWidth: 2,
          }}
          aria-label="Taxa de engajamento por período"
        />
      </ComposedChart>
    </ChartContainer>
  )
}