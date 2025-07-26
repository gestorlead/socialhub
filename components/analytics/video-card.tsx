'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TikTokVideo } from '@/types/tiktok'
import { Eye, Heart, MessageCircle, Share2, Play, Clock } from 'lucide-react'
import Image from 'next/image'

interface VideoCardProps {
  video: TikTokVideo
  onClick?: () => void
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatRelativeTime = (timestamp: number | string) => {
    // Handle both Unix timestamp (seconds) and ISO string
    const date = typeof timestamp === 'number' 
      ? new Date(timestamp * 1000)  // Convert Unix timestamp to milliseconds
      : new Date(timestamp)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    const intervals = [
      { label: 'ano', seconds: 31536000 },
      { label: 'mês', seconds: 2592000 },
      { label: 'semana', seconds: 604800 },
      { label: 'dia', seconds: 86400 },
      { label: 'hora', seconds: 3600 },
      { label: 'minuto', seconds: 60 },
      { label: 'segundo', seconds: 1 }
    ]
    
    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds)
      if (count >= 1) {
        const plural = count !== 1 ? 's' : ''
        return `há ${count} ${interval.label}${plural}`
      }
    }
    
    return 'agora mesmo'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-[9/16] bg-gray-100">
        {video.cover_image_url ? (
          <Image
            src={video.cover_image_url}
            alt={video.title || video.video_description || 'TikTok video'}
            fill
            className="object-cover"
            unoptimized // TikTok CDN images have 6-hour TTL
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Play className="h-12 w-12" />
          </div>
        )}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            <Clock className="inline h-3 w-3 mr-1" />
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-2 line-clamp-2">
          {video.title || video.video_description || 'Sem título'}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{formatNumber(video.view_count || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>{formatNumber(video.like_count || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>{formatNumber(video.comment_count || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Share2 className="h-4 w-4" />
            <span>{formatNumber(video.share_count || 0)}</span>
          </div>
        </div>
        {video.create_time && (
          <p className="text-xs text-gray-500 mt-3">
            {formatRelativeTime(video.create_time)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}