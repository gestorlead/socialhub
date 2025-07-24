'use client'

import { useState } from 'react'
import { VideoCard } from './video-card'
import { VideoStatsModal } from './video-stats-modal'
import { TikTokVideo } from '@/types/tiktok'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface VideoListProps {
  videos: TikTokVideo[]
  loading?: boolean
  error?: string
}

export function VideoList({ videos, loading, error }: VideoListProps) {
  const [selectedVideo, setSelectedVideo] = useState<TikTokVideo | null>(null)

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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhum vídeo encontrado</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map((video) => (
          <VideoCard
            key={video.video_id}
            video={video}
            onClick={() => setSelectedVideo(video)}
          />
        ))}
      </div>
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