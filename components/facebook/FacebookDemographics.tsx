"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Globe, MapPin, Users, Calendar } from "lucide-react"
import { useFacebookDailyStats } from "@/hooks/use-facebook-daily-stats"

interface FacebookDemographicsProps {
  pageId: string
}

interface DemographicData {
  [key: string]: number
}

function DemographicSection({ 
  title, 
  data, 
  icon, 
  color 
}: { 
  title: string
  data: DemographicData | null
  icon: React.ReactNode
  color: string
}) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <div className={`p-2 rounded-lg ${color} mr-3`}>
            {icon}
          </div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Dados não disponíveis</p>
        </CardContent>
      </Card>
    )
  }

  // Sort data by count descending
  const sortedData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10) // Show top 10

  const total = Object.values(data).reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className={`p-2 rounded-lg ${color} mr-3`}>
          {icon}
        </div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedData.map(([key, count], index) => {
            const percentage = total > 0 ? (count / total) * 100 : 0
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{key}</span>
                  <Badge variant="secondary" className="text-xs">
                    {percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {count.toLocaleString()} seguidores
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function GenderAgeSection({ data }: { data: DemographicData | null }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <div className="p-2 rounded-lg bg-pink-100 mr-3">
            <Users className="w-4 h-4 text-pink-600" />
          </div>
          <CardTitle className="text-sm font-medium">Gênero e Idade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Dados não disponíveis</p>
        </CardContent>
      </Card>
    )
  }

  // Parse gender and age data
  const genderData: { [key: string]: number } = {}
  const ageData: { [key: string]: number } = {}

  Object.entries(data).forEach(([key, count]) => {
    // Keys are in format like "F.25-34" or "M.18-24"
    const [gender, age] = key.split('.')
    
    if (gender && age) {
      // Aggregate by gender
      const genderLabel = gender === 'F' ? 'Feminino' : gender === 'M' ? 'Masculino' : 'Outro'
      genderData[genderLabel] = (genderData[genderLabel] || 0) + count
      
      // Aggregate by age group
      ageData[age] = (ageData[age] || 0) + count
    }
  })

  const totalGender = Object.values(genderData).reduce((sum, count) => sum + count, 0)
  const totalAge = Object.values(ageData).reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="p-2 rounded-lg bg-pink-100 mr-3">
          <Users className="w-4 h-4 text-pink-600" />
        </div>
        <CardTitle className="text-sm font-medium">Gênero e Idade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender Distribution */}
          <div>
            <h4 className="text-sm font-medium mb-3">Por Gênero</h4>
            <div className="space-y-3">
              {Object.entries(genderData)
                .sort(([, a], [, b]) => b - a)
                .map(([gender, count]) => {
                  const percentage = totalGender > 0 ? (count / totalGender) * 100 : 0
                  
                  return (
                    <div key={gender} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{gender}</span>
                        <Badge variant="secondary" className="text-xs">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Age Distribution */}
          <div>
            <h4 className="text-sm font-medium mb-3">Por Idade</h4>
            <div className="space-y-3">
              {Object.entries(ageData)
                .sort(([, a], [, b]) => b - a)
                .map(([age, count]) => {
                  const percentage = totalAge > 0 ? (count / totalAge) * 100 : 0
                  
                  return (
                    <div key={age} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{age} anos</span>
                        <Badge variant="secondary" className="text-xs">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FacebookDemographics({ pageId }: FacebookDemographicsProps) {
  const { data, loading, error } = useFacebookDailyStats({ pageId, days: 7 })

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <Card key={n}>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="text-center p-6">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          {error ? 'Erro ao carregar dados demográficos' : 'Dados demográficos não disponíveis'}
        </p>
      </div>
    )
  }

  // Get the most recent demographic data
  const latestData = data[0]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Dados Demográficos</h3>
        <p className="text-sm text-muted-foreground">
          Baseado nos dados mais recentes dos seguidores da página
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DemographicSection
          title="Por País"
          data={latestData.page_fans_country}
          icon={<Globe className="w-4 h-4 text-blue-600" />}
          color="bg-blue-100"
        />

        <DemographicSection
          title="Por Cidade"
          data={latestData.page_fans_city}
          icon={<MapPin className="w-4 h-4 text-green-600" />}
          color="bg-green-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GenderAgeSection data={latestData.page_fans_gender_age} />

        <DemographicSection
          title="Por Idioma"
          data={latestData.page_fans_locale}
          icon={<Globe className="w-4 h-4 text-purple-600" />}
          color="bg-purple-100"
        />
      </div>
    </div>
  )
}