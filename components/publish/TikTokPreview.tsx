'use client'

import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Music } from 'lucide-react'
import Image from 'next/image'

interface TikTokPreviewProps {
  mediaFile: File | null
  mediaPreview: string | null
  caption: string
  userProfile?: {
    display_name?: string
    username?: string
    avatar_url?: string
    avatar_url_100?: string
    avatar_large_url?: string
    is_verified?: boolean
  }
  settings?: {
    privacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
    allowComments: boolean
    allowDuet: boolean
    allowStitch: boolean
    coverTimestamp: number
  }
}

export function TikTokPreview({ 
  mediaFile, 
  mediaPreview, 
  caption, 
  userProfile,
  settings 
}: TikTokPreviewProps) {
  const getPrivacyText = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC_TO_EVERYONE': return 'Público'
      case 'MUTUAL_FOLLOW_FRIENDS': return 'Amigos'
      case 'FOLLOWER_OF_CREATOR': return 'Seguidores'
      case 'SELF_ONLY': return 'Privado'
      default: return 'Público'
    }
  }

  const formatCaption = (text: string) => {
    if (!text) return null
    
    return text.split(' ').map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <span key={index} className="text-white font-semibold">
            {word}{' '}
          </span>
        )
      }
      if (word.startsWith('@')) {
        return (
          <span key={index} className="text-white font-semibold">
            {word}{' '}
          </span>
        )
      }
      return word + ' '
    })
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Preview TikTok</h3>
        {settings && (
          <span className="text-xs bg-muted px-2 py-1 rounded-full">
            {getPrivacyText(settings.privacy)}
          </span>
        )}
      </div>

      {/* Mobile Frame */}
      <div className="max-w-[280px] mx-auto">
        <div className="bg-black rounded-[24px] p-1 shadow-2xl">
          <div className="bg-black rounded-[20px] overflow-hidden relative" style={{ aspectRatio: '9/19.5' }}>
            
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-white text-xs">
              <div className="flex items-center gap-1">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                </div>
                <span className="ml-1">Vivo</span>
              </div>
              <div className="text-center font-medium">9:41</div>
              <div className="flex items-center gap-1">
                <div className="text-xs">100%</div>
                <div className="w-6 h-3 border border-white rounded-sm">
                  <div className="w-full h-full bg-white rounded-sm"></div>
                </div>
              </div>
            </div>

            {/* Video/Image Content */}
            <div className="w-full h-full relative bg-gray-900 flex items-center justify-center">
              {mediaPreview ? (
                <>
                  {mediaFile?.type.startsWith('video/') ? (
                    <video
                      src={mediaPreview}
                      className="w-full h-full object-contain"
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </>
              ) : (
                <div className="text-white/50 text-center p-4">
                  <div className="w-16 h-16 mx-auto mb-2 bg-white/10 rounded-lg flex items-center justify-center">
                    <Music className="w-8 h-8" />
                  </div>
                  <p className="text-sm">Adicione mídia para ver o preview</p>
                </div>
              )}

              {/* TikTok UI Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Right Side Actions */}
                <div className="absolute right-3 bottom-20 flex flex-col gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur mb-1">
                      {userProfile?.avatar_large_url || userProfile?.avatar_url_100 || userProfile?.avatar_url ? (
                        <img
                          src={userProfile.avatar_large_url || userProfile.avatar_url_100 || userProfile.avatar_url}
                          alt="Profile"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {userProfile?.display_name?.[0] || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center -mt-2 border-2 border-black">
                      <span className="text-white text-xs font-bold">+</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">1.2K</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">89</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                      <Bookmark className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">12</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                      <Share className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">Share</span>
                  </div>

                  <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-yellow-400 rounded-lg animate-spin">
                    <div className="w-full h-full bg-black rounded-lg flex items-center justify-center m-0.5">
                      <Music className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                {/* Bottom Content Info */}
                <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">
                        @{userProfile?.username || 'usuario'}
                      </span>
                      {userProfile?.is_verified && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                    
                    {caption && (
                      <div className="text-white text-sm leading-relaxed">
                        {formatCaption(caption)}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-white/80">
                      <Music className="w-4 h-4" />
                      <span className="text-sm">Som original - @{userProfile?.username || 'usuario'}</span>
                    </div>
                  </div>
                </div>

                {/* Top Bar */}
                <div className="absolute top-12 left-0 right-0 flex items-center justify-between px-4 text-white">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold opacity-50">Seguindo</span>
                    <span className="text-lg font-semibold">Para você</span>
                  </div>
                  <MoreHorizontal className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Summary */}
      {settings && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Configurações:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Privacidade: {getPrivacyText(settings.privacy)}</div>
            <div>Comentários: {settings.allowComments ? 'Permitidos' : 'Desabilitados'}</div>
            <div>Duet: {settings.allowDuet ? 'Permitido' : 'Desabilitado'}</div>
            <div>Stitch: {settings.allowStitch ? 'Permitido' : 'Desabilitado'}</div>
          </div>
        </div>
      )}
    </div>
  )
}