import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ExternalLink, Heart, MessageCircle, Eye, TrendingUp, Image as ImageIcon, Video, Layers } from "lucide-react"
import { formatNumber } from "@/lib/utils"

interface InstagramMediaInsight {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  permalink: string
  timestamp: string
  insights: {
    engagement: number
    impressions: number
    reach: number
    likes?: number
    comments?: number
  }
}

interface InstagramMediaInsightsProps {
  mediaInsights: InstagramMediaInsight[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function MediaTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'VIDEO':
      return <Video className="w-4 h-4" />
    case 'CAROUSEL_ALBUM':
      return <Layers className="w-4 h-4" />
    default:
      return <ImageIcon className="w-4 h-4" />
  }
}

function MediaCard({ media }: { media: InstagramMediaInsight }) {
  const engagementRate = media.insights.reach > 0 
    ? (media.insights.engagement / media.insights.reach) * 100 
    : 0

  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MediaTypeIcon type={media.media_type} />
            <Badge variant="outline" className="text-xs">
              {media.media_type === 'IMAGE' ? 'Foto' : 
               media.media_type === 'VIDEO' ? 'Vídeo' : 'Carrossel'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <a href={media.permalink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
        
        {media.caption && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {media.caption.length > 100 
              ? `${media.caption.substring(0, 100)}...` 
              : media.caption}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground">
          {new Date(media.timestamp).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Engajamento</span>
              </div>
              <span className="font-semibold">{formatNumber(media.insights.engagement)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Impressões</span>
              </div>
              <span className="font-semibold">{formatNumber(media.insights.impressions)}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Alcance</span>
              </div>
              <span className="font-semibold">{formatNumber(media.insights.reach)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Taxa Eng.</span>
              </div>
              <span className="font-semibold text-purple-600">
                {engagementRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-16 h-5" />
              </div>
            </div>
            <Skeleton className="w-full h-4 mt-2" />
            <Skeleton className="w-24 h-3" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-12 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-12 h-4" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-12 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-12 h-4" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function InstagramMediaInsights({ 
  mediaInsights, 
  loading, 
  error, 
  onRefresh 
}: InstagramMediaInsightsProps) {
  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={onRefresh} variant="outline">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  if (mediaInsights.length === 0) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Nenhum post encontrado</h3>
        <p className="text-muted-foreground mb-4">
          Publique alguns posts no Instagram para ver as análises aqui.
        </p>
        <Button onClick={onRefresh} variant="outline">
          Atualizar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Posts Recentes</h3>
          <p className="text-sm text-muted-foreground">
            Últimos {mediaInsights.length} posts com suas métricas de performance
          </p>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mediaInsights.map((media) => (
          <MediaCard key={media.id} media={media} />
        ))}
      </div>
    </div>
  )
}