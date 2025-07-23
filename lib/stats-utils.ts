// Utility functions for TikTok statistics calculations and analysis

export interface StatPoint {
  date: string
  followers: number
  following: number
  likes: number
  videos: number
}

export interface GrowthMetrics {
  absolute: number
  percentage: number
  daily_average: number
  trend: 'growing' | 'declining' | 'stable'
}

export interface PeriodComparison {
  current_period: StatPoint[]
  previous_period: StatPoint[]
  growth: {
    followers: GrowthMetrics
    following: GrowthMetrics
    likes: GrowthMetrics
    videos: GrowthMetrics
  }
}

/**
 * Calculate growth metrics between two values
 */
export function calculateGrowthMetrics(
  startValue: number,
  endValue: number,
  days: number = 1
): GrowthMetrics {
  const absolute = endValue - startValue
  const percentage = startValue > 0 ? (absolute / startValue) * 100 : 0
  const daily_average = days > 0 ? absolute / days : 0
  
  let trend: 'growing' | 'declining' | 'stable' = 'stable'
  if (absolute > 0) trend = 'growing'
  else if (absolute < 0) trend = 'declining'

  return {
    absolute: Math.round(absolute),
    percentage: Math.round(percentage * 100) / 100,
    daily_average: Math.round(daily_average * 100) / 100,
    trend
  }
}

/**
 * Calculate moving average for a dataset
 */
export function calculateMovingAverage(
  data: number[],
  windowSize: number = 7
): number[] {
  if (data.length < windowSize) return data

  const result: number[] = []
  
  for (let i = windowSize - 1; i < data.length; i++) {
    const window = data.slice(i - windowSize + 1, i + 1)
    const average = window.reduce((sum, val) => sum + val, 0) / windowSize
    result.push(Math.round(average * 100) / 100)
  }
  
  return result
}

/**
 * Find peaks and valleys in the data
 */
export function findPeaksAndValleys(data: StatPoint[]): {
  peaks: Array<{ date: string, value: number, metric: string }>
  valleys: Array<{ date: string, value: number, metric: string }>
} {
  const peaks: Array<{ date: string, value: number, metric: string }> = []
  const valleys: Array<{ date: string, value: number, metric: string }> = []

  const metrics = ['followers', 'likes'] as const

  metrics.forEach(metric => {
    const values = data.map(d => d[metric])
    
    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1]
      const current = values[i]
      const next = values[i + 1]
      
      // Peak: current value is higher than both neighbors
      if (current > prev && current > next) {
        peaks.push({
          date: data[i].date,
          value: current,
          metric
        })
      }
      
      // Valley: current value is lower than both neighbors
      if (current < prev && current < next) {
        valleys.push({
          date: data[i].date,
          value: current,
          metric
        })
      }
    }
  })

  return { peaks, valleys }
}

/**
 * Calculate correlation between metrics
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Analyze engagement patterns
 */
export function analyzeEngagement(data: StatPoint[]): {
  avg_engagement_rate: number
  engagement_trend: 'improving' | 'declining' | 'stable'
  best_engagement_day: { date: string, rate: number } | null
  worst_engagement_day: { date: string, rate: number } | null
} {
  const engagementRates = data.map(point => ({
    date: point.date,
    rate: point.followers > 0 ? point.likes / point.followers : 0
  }))

  if (engagementRates.length === 0) {
    return {
      avg_engagement_rate: 0,
      engagement_trend: 'stable',
      best_engagement_day: null,
      worst_engagement_day: null
    }
  }

  const avgRate = engagementRates.reduce((sum, er) => sum + er.rate, 0) / engagementRates.length
  
  // Compare first half vs second half to determine trend
  const midPoint = Math.floor(engagementRates.length / 2)
  const firstHalfAvg = engagementRates.slice(0, midPoint).reduce((sum, er) => sum + er.rate, 0) / midPoint
  const secondHalfAvg = engagementRates.slice(midPoint).reduce((sum, er) => sum + er.rate, 0) / (engagementRates.length - midPoint)
  
  let engagement_trend: 'improving' | 'declining' | 'stable' = 'stable'
  const trendDiff = secondHalfAvg - firstHalfAvg
  if (Math.abs(trendDiff) > 0.01) { // 1% threshold
    engagement_trend = trendDiff > 0 ? 'improving' : 'declining'
  }

  const bestDay = engagementRates.reduce((best, current) => 
    current.rate > best.rate ? current : best
  )
  
  const worstDay = engagementRates.reduce((worst, current) => 
    current.rate < worst.rate ? current : worst
  )

  return {
    avg_engagement_rate: Math.round(avgRate * 1000) / 1000,
    engagement_trend,
    best_engagement_day: bestDay,
    worst_engagement_day: worstDay
  }
}

/**
 * Calculate consistency score based on growth variance
 */
export function calculateConsistencyScore(data: StatPoint[]): number {
  if (data.length < 2) return 100

  const dailyGrowth = []
  for (let i = 1; i < data.length; i++) {
    dailyGrowth.push(data[i].followers - data[i - 1].followers)
  }

  const mean = dailyGrowth.reduce((sum, val) => sum + val, 0) / dailyGrowth.length
  const variance = dailyGrowth.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyGrowth.length
  const standardDeviation = Math.sqrt(variance)

  // Normalize to 0-100 scale (lower std dev = higher consistency)
  const maxStdDev = 50 // Assume max reasonable std dev for scaling
  const consistencyScore = Math.max(0, 100 - (standardDeviation / maxStdDev * 100))
  
  return Math.round(consistencyScore * 100) / 100
}

/**
 * Predict future growth based on historical trends
 */
export function predictGrowth(
  data: StatPoint[],
  daysToPredict: number = 7
): Array<{ date: string, predicted_followers: number, confidence: number }> {
  if (data.length < 7) return [] // Need at least a week of data

  // Use linear regression for simple prediction
  const recentData = data.slice(-14) // Use last 2 weeks
  const xValues = recentData.map((_, index) => index)
  const yValues = recentData.map(point => point.followers)

  // Calculate linear regression coefficients
  const n = recentData.length
  const sumX = xValues.reduce((a, b) => a + b, 0)
  const sumY = yValues.reduce((a, b) => a + b, 0)
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared for confidence
  const yMean = sumY / n
  const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0)
  const ssResidual = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept
    return sum + Math.pow(y - predicted, 2)
  }, 0)
  const rSquared = 1 - (ssResidual / ssTotal)
  const confidence = Math.max(0, Math.min(100, rSquared * 100))

  // Generate predictions
  const predictions = []
  const lastDate = new Date(data[data.length - 1].date)
  
  for (let i = 1; i <= daysToPredict; i++) {
    const predictedValue = slope * (n + i - 1) + intercept
    const futureDate = new Date(lastDate)
    futureDate.setDate(futureDate.getDate() + i)
    
    predictions.push({
      date: futureDate.toISOString().split('T')[0],
      predicted_followers: Math.max(0, Math.round(predictedValue)),
      confidence: Math.round(confidence * 100) / 100
    })
  }

  return predictions
}

/**
 * Compare two periods and analyze the difference
 */
export function comparePeriods(
  currentPeriod: StatPoint[],
  previousPeriod: StatPoint[]
): PeriodComparison {
  const getCurrentMetrics = (data: StatPoint[]) => {
    if (data.length === 0) return { followers: 0, following: 0, likes: 0, videos: 0 }
    const first = data[0]
    const last = data[data.length - 1]
    return {
      followers: calculateGrowthMetrics(first.followers, last.followers, data.length - 1),
      following: calculateGrowthMetrics(first.following, last.following, data.length - 1),
      likes: calculateGrowthMetrics(first.likes, last.likes, data.length - 1),
      videos: calculateGrowthMetrics(first.videos, last.videos, data.length - 1)
    }
  }

  return {
    current_period: currentPeriod,
    previous_period: previousPeriod,
    growth: getCurrentMetrics(currentPeriod)
  }
}

/**
 * Format numbers for display
 */
export function formatStatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toLocaleString()
}

/**
 * Format growth percentage with appropriate styling
 */
export function formatGrowthPercentage(percentage: number): {
  formatted: string
  color: 'green' | 'red' | 'gray'
  trend: 'up' | 'down' | 'neutral'
} {
  const formatted = `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`
  
  if (percentage > 0.1) {
    return { formatted, color: 'green', trend: 'up' }
  } else if (percentage < -0.1) {
    return { formatted, color: 'red', trend: 'down' }
  } else {
    return { formatted, color: 'gray', trend: 'neutral' }
  }
}