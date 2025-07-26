'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TikTokVideo } from '@/types/tiktok'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
              {video.embed_html ? (
                <div 
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: video.embed_html }}
                />
              ) : video.embed_link ? (
                <iframe
                  src={video.embed_link}
                  className="w-full h-full border-0"
                  allow="encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={video.title || video.video_description || 'TikTok video'}
                />
              ) : video.cover_image_url ? (
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
              <h3 className="font-semibold text-lg mb-2 text-foreground">
                {video.title || 'Sem título'}
              </h3>
              {video.video_description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {video.video_description}
                </p>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-2 text-sm">
              {video.duration && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Duração: {formatDuration(video.duration)}</span>
                </div>
              )}
              {video.create_time && (
                <div className="flex items-center gap-2 text-muted-foreground">
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
                <div key={stat.label} className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <stat.icon className="h-5 w-5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{stat.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Engagement Rate */}
            <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-primary mb-1">
                Taxa de Engajamento
              </h4>
              <p className="text-3xl font-bold text-primary">
                {engagementRate}%
              </p>
              <p className="text-xs text-primary/80 mt-1">
                (Curtidas + Comentários + Compartilhamentos) / Visualizações
              </p>
            </div>

            {/* Additional Info */}
            {(video.view_count || 0) > 10000 && (
              <div className="bg-green-500/10 dark:bg-green-500/20 rounded-lg p-3">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
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