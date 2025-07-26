'use client'

import { useState, useMemo } from 'react'
import { VideoCard } from './video-card'
import { VideoStatsModal } from './video-stats-modal'
import { TikTokVideo } from '@/types/tiktok'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, RefreshCw, ArrowUpDown } from 'lucide-react'
import { sortTikTokVideos } from '@/lib/tiktok-api-utils'

interface VideoListProps {
  videos: TikTokVideo[]
  loading?: boolean
  error?: string
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  showSorting?: boolean
}

type SortOption = 'date' | 'views' | 'engagement'

export function VideoList({ 
  videos, 
  loading, 
  error, 
  hasMore = false,
  onLoadMore,
  onRefresh,
  showSorting = true
}: VideoListProps) {
  const [selectedVideo, setSelectedVideo] = useState<TikTokVideo | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('date')
  
  const sortedVideos = useMemo(() => {
    if (!videos.length) return videos
    return sortTikTokVideos(videos, sortBy)
  }, [videos, sortBy])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[9/16] rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Erro ao carregar vídeos:</strong></p>
              <p className="text-sm">{error}</p>
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!loading && (!videos || videos.length === 0)) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-gray-400">
          <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum vídeo encontrado</h3>
          <p className="text-gray-500 mb-4">Seus vídeos do TikTok aparecerão aqui quando estiverem disponíveis.</p>
          {onRefresh && (
            <Button
              variant="outline"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar novamente
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex justify-between items-center">
          {/* Sorting */}
          {showSorting && videos.length > 0 && (
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Mais recentes</SelectItem>
                  <SelectItem value="views">Mais visualizados</SelectItem>
                  <SelectItem value="engagement">Maior engajamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          )}
        </div>
        
        {/* Videos Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => setSelectedVideo(video)}
            />
          ))}
        </div>
        
        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center pt-6">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Carregar mais vídeos'
              )}
            </Button>
          </div>
        )}
      </div>
      
      {/* Video Details Modal */}
      {selectedVideo && (
        <VideoStatsModal
          video={selectedVideo}
          open={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  )
}