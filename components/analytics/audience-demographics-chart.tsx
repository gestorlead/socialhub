"use client"

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Users, UserCheck, BarChart3, Globe } from 'lucide-react'

interface AudienceDemographicsChartProps {
  data?: {
    male_percentage?: number
    female_percentage?: number
    other_percentage?: number
    age_groups?: {
      '13-17': number
      '18-24': number
      '25-34': number
      '35-44': number
      '45-54': number
      '55+': number
    }
    countries?: {
      [country: string]: number
    }
  } | null
  loading?: boolean
}

const chartConfig = {
  male: {
    label: "Homens",
    color: "hsl(220, 91%, 60%)", // Azul vibrante
  },
  female: {
    label: "Mulheres",
    color: "hsl(200, 85%, 55%)", // Azul ciano
  },
  other: {
    label: "Outros",
    color: "hsl(240, 80%, 65%)", // Azul roxo
  },
}

const COLORS = [
  "hsl(220, 91%, 60%)", // Azul vibrante - Homens
  "hsl(200, 85%, 55%)", // Azul ciano - Mulheres  
  "hsl(240, 80%, 65%)", // Azul roxo - Outros
]

export function AudienceDemographicsChart({ data, loading }: AudienceDemographicsChartProps) {
  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Se não há dados reais, usar dados de exemplo/estimativa
  const defaultData = {
    male_percentage: 45,
    female_percentage: 52,
    other_percentage: 3,
    age_groups: {
      '13-17': 8,
      '18-24': 35,
      '25-34': 28,
      '35-44': 18,
      '45-54': 8,
      '55+': 3
    },
    countries: {
      'Brasil': 32,
      'Estados Unidos': 18,
      'México': 12,
      'Argentina': 8,
      'Colômbia': 6,
      'Chile': 5,
      'Peru': 4,
      'Outros': 15
    }
  }

  const demographicsData = data || defaultData

  const chartData = [
    {
      name: "Mulheres",
      value: demographicsData.female_percentage || 0,
      color: COLORS[1],
      icon: "♀",
    },
    {
      name: "Homens", 
      value: demographicsData.male_percentage || 0,
      color: COLORS[0],
      icon: "♂",
    },
    {
      name: "Outros",
      value: demographicsData.other_percentage || 0,
      color: COLORS[2], 
      icon: "⚪",
    },
  ].filter(item => item.value > 0)

  if (!chartData.length || chartData.every(item => item.value === 0)) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="mb-2">Dados demográficos não disponíveis</p>
          <p className="text-sm">Os dados de audiência aparecerão quando disponíveis na API</p>
        </div>
      </div>
    )
  }

  const totalPercentage = chartData.reduce((sum, item) => sum + item.value, 0)

  // Preparar dados para o gráfico de idades
  const ageData = demographicsData.age_groups ? Object.entries(demographicsData.age_groups).map(([age, percentage]) => ({
    age,
    percentage,
    fill: `hsl(${200 + (Object.keys(demographicsData.age_groups!).indexOf(age) * 10)}, 70%, ${55 + (Object.keys(demographicsData.age_groups!).indexOf(age) * 2)}%)`
  })) : []

  // Preparar dados para o gráfico de países
  const countryData = demographicsData.countries ? Object.entries(demographicsData.countries)
    .sort(([,a], [,b]) => b - a) // Ordenar por percentual decrescente
    .map(([country, percentage], index) => ({
      country,
      percentage,
      fill: `hsl(${210 + (index * 15)}, 70%, ${50 + (index * 3)}%)`
    })) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold">Perfil da Audiência</h3>
        {!data && (
          <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
            Estimativa
          </span>
        )}
      </div>

      {/* Primeira linha: Gênero e Idade lado a lado */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Gênero (Pie Chart) */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Distribuição por Gênero</h4>

          <ChartContainer config={chartConfig} className="h-[220px]">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={30}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={450}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => [
                      `${Number(value).toFixed(1)}%`,
                      props.payload.name
                    ]}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {chartData.map((item, index) => (
              <div key={index} className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <div 
                    className="w-4 h-4 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-lg">{item.icon}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">{item.name}</div>
                <div className="text-lg font-bold" style={{ color: item.color }}>
                  {item.value.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de Idades (Bar Chart) */}
        {ageData.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-medium text-muted-foreground">Distribuição por Idade</h4>
            </div>
            
            <ChartContainer config={chartConfig} className="h-[220px]">
              <BarChart data={ageData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="age" 
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
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        `${Number(value).toFixed(1)}%`,
                        'Percentual'
                      ]}
                      labelFormatter={(label) => `Idade: ${label} anos`}
                    />
                  }
                />
                <Bar 
                  dataKey="percentage" 
                  radius={[4, 4, 0, 0]}
                  fill="hsl(220, 91%, 60%)"
                />
              </BarChart>
            </ChartContainer>

            {/* Age Statistics */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {ageData.map((item, index) => (
                <div key={index} className="text-center p-2 bg-muted/20 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{item.age} anos</div>
                  <div className="text-sm font-bold text-blue-600">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Segunda linha: Gráfico de Países */}
      {countryData.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-medium text-muted-foreground">Distribuição por País</h4>
          </div>
          
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={countryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="country" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      `${Number(value).toFixed(1)}%`,
                      'Percentual'
                    ]}
                    labelFormatter={(label) => `País: ${label}`}
                  />
                }
              />
              <Bar 
                dataKey="percentage" 
                radius={[4, 4, 0, 0]}
                fill="hsl(210, 100%, 50%)"
              />
            </BarChart>
          </ChartContainer>

          {/* Country Statistics */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {countryData.slice(0, 8).map((item, index) => (
              <div key={index} className="text-center p-2 bg-muted/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{item.country}</div>
                <div className="text-sm font-bold text-blue-600">
                  {item.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Total: {totalPercentage.toFixed(1)}% da audiência mapeada
        </p>
        {!data && (
          <p className="text-xs mt-1">
            * Dados estimados baseados em padrões típicos do TikTok
          </p>
        )}
      </div>
    </div>
  )
}