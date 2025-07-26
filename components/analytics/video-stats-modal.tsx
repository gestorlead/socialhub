'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TikTokVideo } from '@/types/tiktok'
import { Button } from '@/components/ui/button'
import { ExternalLink, Eye, Heart, MessageCircle, Share2, Play, Clock, Calendar } from 'lucide-react'
import Image from 'next/image'

interface VideoStatsModalProps {
  video: TikTokVideo
  open: boolean
  onClose: () => void
}

export function VideoStatsModal({ video, open, onClose }: VideoStatsModalProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num)
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

  const stats = [
    { icon: Eye, label: 'Visualizações', value: formatNumber(video.view_count || 0) },
    { icon: Heart, label: 'Curtidas', value: formatNumber(video.like_count || 0) },
    { icon: MessageCircle, label: 'Comentários', value: formatNumber(video.comment_count || 0) },
    { icon: Share2, label: 'Compartilhamentos', value: formatNumber(video.share_count || 0) },
  ]

  const engagementRate = (video.view_count || 0) > 0 
    ? (((video.like_count || 0) + (video.comment_count || 0) + (video.share_count || 0)) / (video.view_count || 1) * 100).toFixed(2)
    : '0'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estatísticas do Vídeo</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Video Preview */}
          <div>
            <div className="relative aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden">
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
                  <Play className="h-16 w-16" />
                </div>
              )}
            </div>
            {video.share_url && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => window.open(video.share_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver no TikTok
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-6">
            {/* Title and Description */}
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {video.title || 'Sem título'}
              </h3>
              {video.video_description && (
                <p className="text-sm text-gray-600 line-clamp-3">
                  {video.video_description}
                </p>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-2 text-sm">
              {video.duration && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>Duração: {formatDuration(video.duration)}</span>
                </div>
              )}
              {video.create_time && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Publicado {formatRelativeTime(video.create_time)}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <stat.icon className="h-4 w-4" />
                    <span className="text-sm">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Engagement Rate */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                Taxa de Engajamento
              </h4>
              <p className="text-3xl font-bold text-blue-600">
                {engagementRate}%
              </p>
              <p className="text-xs text-blue-700 mt-1">
                (Curtidas + Comentários + Compartilhamentos) / Visualizações
              </p>
            </div>

            {/* Additional Info */}
            {(video.view_count || 0) > 10000 && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800">
                  🔥 Vídeo com alta performance (&gt;10K visualizações)!
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}