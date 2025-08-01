"use client"

import { useState } from "react"
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Music, Share2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { findNetworkOption } from "@/lib/network-configs"

interface NetworkPreviewProps {
  optionId: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'carousel'
  caption: string
  username?: string
  multipleMedia?: boolean
  mediaCount?: number
  allMediaUrls?: string[]
  showStatusBar?: boolean
  statusBarContent?: {
    time: string
    signal: React.ReactNode
    wifi: React.ReactNode
    battery: React.ReactNode
  }
}

// Componente interno para carrossel de imagens
function MediaCarousel({ 
  urls, 
  mediaType, 
  className = "w-full h-full",
  showControls = true,
  aspectRatio = "aspect-square"
}: {
  urls: string[]
  mediaType: 'image' | 'video' | 'carousel'
  className?: string
  showControls?: boolean
  aspectRatio?: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const mediaUrls = urls.length > 0 ? urls : ['']

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length)
  }

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]
    return (
      <div className={`${className} ${aspectRatio} relative bg-black`}>
        {url ? (
          mediaType === 'video' ? (
            <video src={url} className="w-full h-full object-cover" muted autoPlay loop />
          ) : (
            <img src={url} alt="Preview" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-gray-400 text-sm font-medium">Nenhuma mídia</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${className} ${aspectRatio} relative bg-black overflow-hidden`}>
      {/* Imagens do carrossel */}
      <div 
        className="flex transition-transform duration-300 ease-in-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {mediaUrls.map((url, index) => (
          <div key={index} className="w-full h-full flex-shrink-0">
            {url ? (
              mediaType === 'video' ? (
                <video src={url} className="w-full h-full object-cover" muted autoPlay loop />
              ) : (
                <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-gray-400 text-sm font-medium">Nenhuma mídia</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Indicadores de posição */}
      {mediaUrls.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
          {currentIndex + 1}/{mediaUrls.length}
        </div>
      )}

      {/* Controles de navegação */}
      {showControls && mediaUrls.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Pontos indicadores */}
      {mediaUrls.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {mediaUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function NetworkPreview({ 
  optionId, 
  mediaUrl, 
  mediaType, 
  caption, 
  username = "usuario",
  multipleMedia = false,
  mediaCount = 1,
  allMediaUrls = [],
  showStatusBar = false,
  statusBarContent
}: NetworkPreviewProps) {
  const result = findNetworkOption(optionId)
  if (!result) return null

  const { network, option } = result
  
  // Preparar URLs das mídias para o carrossel
  const mediaUrls = allMediaUrls.length > 0 ? allMediaUrls : (mediaUrl ? [mediaUrl] : [''])

  // Instagram Feed Preview
  if (optionId === 'instagram-feed') {
    return (
      <div className="w-full h-full bg-white dark:bg-black flex flex-col relative overflow-hidden">
        {/* Status Bar */}
        {showStatusBar && statusBarContent && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-black/10 dark:bg-white/10 backdrop-blur-sm z-30 flex items-center justify-between px-4 pt-0.5">
            <span className="text-black dark:text-white text-[9px] font-bold">{statusBarContent.time}</span>
            <div className="flex items-center gap-1">
              {statusBarContent.signal}
              {statusBarContent.wifi}
              {statusBarContent.battery}
            </div>
          </div>
        )}

        {/* Instagram App Header */}
        <div className="flex items-center justify-between p-3 pt-9 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 z-20">
          <div className="text-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
            Instagram
          </div>
          <div className="flex items-center gap-4">
            <Heart className="w-6 h-6 dark:text-white" />
            <div className="relative">
              <Send className="w-6 h-6 -rotate-12 dark:text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">9</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feed Content */}
        <div className="flex-1 overflow-hidden">
          {/* Post Header */}
          <div className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-0.5">
              <div className="w-full h-full bg-white dark:bg-black rounded-full" />
            </div>
            <span className="font-semibold text-sm flex-1 dark:text-white">{username}</span>
            <MoreHorizontal className="w-5 h-5 dark:text-white" />
          </div>

          {/* Media - Full width, flexible height */}
          <div className="relative flex-1">
            <MediaCarousel 
              urls={mediaUrls}
              mediaType={mediaType}
              className="w-full h-full"
              aspectRatio=""
              showControls={true}
            />
          </div>

          {/* Actions */}
          <div className="p-3 space-y-2">
            <div className="flex items-center">
              <div className="flex items-center gap-4 flex-1">
                <Heart className="w-6 h-6 dark:text-white" />
                <MessageCircle className="w-6 h-6 scale-x-[-1] dark:text-white" />
                <Send className="w-6 h-6 -rotate-12 dark:text-white" />
              </div>
              <Bookmark className="w-6 h-6 dark:text-white" />
            </div>
            
            <div className="space-y-1">
              <div className="font-semibold text-sm dark:text-white">1.234 curtidas</div>
              {caption && (
                <div className="text-sm dark:text-white">
                  <span className="font-semibold">{username}</span>{' '}
                  <span className="whitespace-pre-wrap">{caption}</span>
                </div>
              )}
              <div className="text-xs text-gray-500">Ver todos os 45 comentários</div>
              <div className="text-xs text-gray-500">Há 2 horas</div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="flex items-center justify-around py-3 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <svg className="w-6 h-6 dark:fill-white fill-black" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <svg className="w-6 h-6 dark:stroke-white stroke-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M14.5 9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <div className="relative">
            <svg className="w-6 h-6 dark:stroke-white stroke-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">+</span>
            </div>
          </div>
          <svg className="w-6 h-6 dark:stroke-white stroke-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-600" />
        </div>
      </div>
    )
  }

  // Instagram Stories Preview
  if (optionId === 'instagram-stories') {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Story Content */}
        <div className="absolute inset-0">
          {mediaType === 'video' ? (
            <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
          )}
        </div>
        
        {/* Story Header */}
        <div className="absolute top-0 left-0 right-0 p-3 pt-12 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 ring-2 ring-white" />
            <span className="text-white text-sm font-semibold">{username}</span>
            <span className="text-white/60 text-xs">2h</span>
            <X className="ml-auto w-5 h-5 text-white" />
          </div>
          <div className="flex gap-1 mt-2">
            {[...Array(Math.max(1, mediaCount))].map((_, i) => (
              <div 
                key={i} 
                className={`h-0.5 flex-1 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/30'}`} 
              />
            ))}
          </div>
        </div>

        {/* Story Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8">
          <div className="bg-black/20 backdrop-blur rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-white text-sm flex-1">Enviar mensagem</span>
            <Heart className="w-5 h-5 text-white" />
            <Send className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // Instagram Reels Preview
  if (optionId === 'instagram-reels') {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Video Background - Full Screen */}
        <div className="absolute inset-0">
          <MediaCarousel 
            urls={mediaUrls}
            mediaType={mediaType}
            className="w-full h-full"
            aspectRatio=""
            showControls={false}
          />
        </div>

        {/* Status Bar */}
        {showStatusBar && statusBarContent && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-black/20 backdrop-blur-sm z-30 flex items-center justify-between px-4 pt-0.5">
            <span className="text-white text-[9px] font-bold drop-shadow-sm">{statusBarContent.time}</span>
            <div className="flex items-center gap-1">
              {statusBarContent.signal}
              {statusBarContent.wifi}  
              {statusBarContent.battery}
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-9">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/30 to-transparent">
            <span className="text-white font-bold text-lg drop-shadow-sm">Reels</span>
            <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </div>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-12 left-0 right-0 z-10 flex items-end px-3">
          {/* Left Side - Caption */}
          <div className="flex-1 pr-12">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              <span className="text-white font-semibold text-sm">{username}</span>
              <button className="text-white/80 text-xs border border-white/60 px-2 py-0.5 rounded">
                Seguir
              </button>
            </div>
            {caption && (
              <div className="text-white text-sm mb-2 leading-tight">{caption}</div>
            )}
            <div className="flex items-center gap-2">
              <Music className="w-3 h-3 text-white" />
              <div className="flex-1 overflow-hidden">
                <div className="text-white text-xs animate-marquee whitespace-nowrap">
                  Áudio original - {username}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <Heart className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-xs font-medium">24.5K</span>
            </div>
            <div className="text-center">
              <MessageCircle className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-xs font-medium">892</span>
            </div>
            <div className="text-center">
              <Send className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-xs font-medium">Enviar</span>
            </div>
            <div className="text-center">
              <Bookmark className="w-6 h-6 text-white mb-1" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center animate-spin-slow">
              <Music className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-md border-t border-white/10">
          <div className="flex items-center justify-around py-3">
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 23h-6.001a1 1 0 01-1-1v-5.455a2.997 2.997 0 10-5.993 0V22a1 1 0 01-1 1H2a1 1 0 01-1-1V11.543a1.002 1.002 0 01.31-.724l10-9.543a1.001 1.001 0 011.38 0l10 9.543a1.002 1.002 0 01.31.724V22a1 1 0 01-1 1z" />
              </svg>
              <span className="text-white text-[10px] mt-1 font-medium">Início</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M14.5 9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span className="text-white/60 text-[10px] mt-1">Pesquisar</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-7 h-7 text-white fill-white" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              <span className="text-white text-[10px] mt-1 font-bold">Reels</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <span className="text-white/60 text-[10px] mt-1">Shop</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-white/30" />
              <span className="text-white/60 text-[10px] mt-1">Perfil</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Facebook Feed Preview
  if (optionId === 'facebook-feed') {
    return (
      <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600" />
          <div className="flex-1">
            <div className="font-semibold text-sm">{username}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>2 h</span>
              <span>·</span>
              <span>🌍</span>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </div>

        {/* Caption */}
        {caption && (
          <div className="px-3 pb-3">
            <p className="text-sm whitespace-pre-wrap">{caption}</p>
          </div>
        )}

        {/* Media */}
        <div className="relative bg-black flex-1">
          {mediaType === 'video' ? (
            <video src={mediaUrl} className="w-full h-full object-cover" controls />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
          )}
          {multipleMedia && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
              1/{mediaCount}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between text-gray-500 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">👍</span>
              </div>
              <span>123</span>
            </div>
            <div className="flex gap-3">
              <span>45 comentários</span>
              <span>12 compartilhamentos</span>
            </div>
          </div>
          
          <div className="flex items-center justify-around pt-2">
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded">
              <span className="text-lg">👍</span>
              <span className="text-sm">Curtir</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Comentar</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded">
              <Share2 className="w-4 h-4" />
              <span className="text-sm">Compartilhar</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // TikTok Preview
  if (optionId === 'tiktok') {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Video Background - Full Screen */}
        <div className="absolute inset-0">
          <MediaCarousel 
            urls={mediaUrls}
            mediaType={mediaType}
            className="w-full h-full"
            aspectRatio=""
            showControls={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
        </div>

        {/* Status Bar */}
        {showStatusBar && statusBarContent && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-black/20 backdrop-blur-sm z-30 flex items-center justify-between px-4 pt-0.5">
            <span className="text-white text-[9px] font-bold drop-shadow-sm">{statusBarContent.time}</span>
            <div className="flex items-center gap-1">
              {statusBarContent.signal}
              {statusBarContent.wifi}
              {statusBarContent.battery}
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-9">
          <div className="flex items-center justify-center px-3 py-3 bg-gradient-to-b from-black/30 to-transparent">
            <div className="flex items-center gap-6">
              <button className="text-white/70 text-sm font-medium drop-shadow-sm">Seguindo</button>
              <button className="text-white text-sm font-bold border-b-2 border-white pb-1 drop-shadow-sm">Para você</button>
            </div>
          </div>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-12 left-0 right-0 z-10 flex items-end px-3">
          {/* Left Side - Caption */}
          <div className="flex-1 pr-14">
            <div className="text-white font-semibold mb-2 text-sm">@{username}</div>
            {caption && (
              <div className="text-white text-sm mb-3 leading-tight">
                {caption}
                <span className="text-white/70"> #{username} #fyp #foryou</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Music className="w-3 h-3 text-white" />
              <div className="flex-1 overflow-hidden">
                <div className="text-white text-xs animate-marquee whitespace-nowrap">
                  som original - {username}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#FE2C55] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">+</span>
              </div>
            </div>

            <div className="text-center">
              <Heart className="w-7 h-7 text-white mb-1" />
              <span className="text-white text-xs font-semibold">1.2M</span>
            </div>

            <div className="text-center">
              <MessageCircle className="w-7 h-7 text-white mb-1" />
              <span className="text-white text-xs font-semibold">892</span>
            </div>

            <div className="text-center">
              <Bookmark className="w-7 h-7 text-white mb-1" />
              <span className="text-white text-xs font-semibold">Salvar</span>
            </div>

            <div className="text-center">
              <Share2 className="w-7 h-7 text-white mb-1" />
              <span className="text-white text-xs font-semibold">Compartilhar</span>
            </div>

            <div className="w-8 h-8 rounded-full bg-black/50 border border-white/30 animate-spin-slow flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-md border-t border-white/10">
          <div className="flex items-center justify-around py-3">
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              <span className="text-white text-[10px] mt-1 font-medium">Início</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-white/60 text-[10px] mt-1">Descobrir</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-11 h-7 bg-white rounded-md flex items-center justify-center shadow-lg">
                  <span className="text-black text-xl font-light">+</span>
                </div>
                <div className="absolute -left-1 top-0 w-3 h-7 bg-[#00F2EA] rounded-l-md" />
                <div className="absolute -right-1 top-0 w-3 h-7 bg-[#FF0050] rounded-r-md" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
              </svg>
              <span className="text-white/60 text-[10px] mt-1">Inbox</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-white/30" />
              <span className="text-white/60 text-[10px] mt-1">Perfil</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // YouTube Preview
  if (optionId === 'youtube') {
    return (
      <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
        {/* Video Player */}
        <div className="relative bg-black flex-1">
          <video src={mediaUrl} className="w-full h-full object-cover" controls />
        </div>

        {/* Video Info */}
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg line-clamp-2">{caption || "Título do vídeo"}</h3>
          
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>10 mil visualizações • há 2 horas</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2">
              <span className="text-lg">👍</span>
              <span className="text-sm">1.2 mil</span>
            </button>
            <button className="flex items-center gap-2">
              <span className="text-lg">👎</span>
            </button>
            <button className="flex items-center gap-2 ml-auto">
              <Share2 className="w-4 h-4" />
              <span className="text-sm">Compartilhar</span>
            </button>
          </div>

          <div className="border-t pt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600" />
            <div className="flex-1">
              <div className="font-semibold text-sm">{username}</div>
              <div className="text-xs text-gray-500">1.23 mi de inscritos</div>
            </div>
            <button className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium">
              Inscrever-se
            </button>
          </div>
        </div>
      </div>
    )
  }

  // YouTube Shorts Preview
  if (optionId === 'youtube-shorts') {
    return (
      <div className="w-full h-full bg-black relative overflow-hidden">
        <div className="w-full h-full relative">
          <video src={mediaUrl} className="w-full h-full object-cover" controls muted />
          
          {/* Shorts Sidebar */}
          <div className="absolute bottom-20 right-2 flex flex-col gap-4 items-center">
            <div className="text-center">
              <div className="w-10 h-10 bg-white rounded-full mb-2" />
              <span className="text-white text-xs">👍</span>
              <span className="text-white text-xs block">123K</span>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-white/20 rounded-full mb-2 flex items-center justify-center">
                <span>👎</span>
              </div>
              <span className="text-white text-xs">Não gostei</span>
            </div>
            <div className="text-center">
              <MessageCircle className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-xs">2.3K</span>
            </div>
            <div className="text-center">
              <Share2 className="w-6 h-6 text-white mb-1" />
              <span className="text-white text-xs">Compartilhar</span>
            </div>
            <MoreHorizontal className="w-6 h-6 text-white" />
          </div>

          {/* Caption */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-6">
            <div className="text-white pr-16">
              <div className="text-sm mb-2">{caption}</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-600" />
                <span className="text-sm font-semibold">@{username}</span>
                <button className="bg-white text-black px-3 py-1 rounded text-xs font-medium">
                  Inscrever-se
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // LinkedIn Preview
  if (optionId === 'linkedin') {
    return (
      <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-700" />
          <div className="flex-1">
            <div className="font-semibold">{username}</div>
            <div className="text-sm text-gray-500">Cargo • 1º</div>
            <div className="text-xs text-gray-500">2 h • 🌐</div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </div>

        {/* Caption */}
        {caption && (
          <div className="px-4 pb-3">
            <p className="text-sm whitespace-pre-wrap">{caption}</p>
          </div>
        )}

        {/* Media */}
        {mediaUrl && (
          <div className="relative bg-gray-100 flex-1">
            {mediaType === 'video' ? (
              <video src={mediaUrl} className="w-full h-full object-cover" controls />
            ) : (
              <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
            )}
          </div>
        )}

        {/* Reactions */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs">👍</span>
                <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs">❤️</span>
                <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs">👏</span>
              </div>
              <span className="ml-2">47</span>
            </div>
            <div className="flex gap-3">
              <span>8 comentários</span>
              <span>2 compartilhamentos</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-around">
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded">
              <span>👍</span>
              <span className="text-sm">Gostei</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Comentar</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded">
              <Share2 className="w-4 h-4" />
              <span className="text-sm">Compartilhar</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded">
              <Send className="w-4 h-4" />
              <span className="text-sm">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Twitter/X Preview  
  if (optionId === 'twitter') {
    return (
      <div className="w-full h-full bg-white dark:bg-black flex flex-col overflow-hidden">
        <div className="p-4 flex gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-400 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-1">
              <span className="font-bold">{username}</span>
              <span className="text-gray-500">@{username}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500">2h</span>
            </div>
            
            {caption && (
              <p className="text-sm whitespace-pre-wrap">{caption}</p>
            )}

            {mediaUrl && (
              <div className="rounded-2xl overflow-hidden flex-1">
                {mediaType === 'video' ? (
                  <video src={mediaUrl} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-gray-500 pt-2">
              <button className="flex items-center gap-2 hover:text-blue-500">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">12</span>
              </button>
              <button className="flex items-center gap-2 hover:text-green-500">
                <div className="w-5 h-5">🔁</div>
                <span className="text-sm">34</span>
              </button>
              <button className="flex items-center gap-2 hover:text-red-500">
                <Heart className="w-5 h-5" />
                <span className="text-sm">128</span>
              </button>
              <button className="flex items-center gap-2 hover:text-blue-500">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Threads Preview
  if (optionId === 'threads') {
    return (
      <div className="w-full h-full bg-white dark:bg-gray-950 flex flex-col overflow-hidden">
        <div className="p-4 flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
            <div className="w-0.5 bg-gray-300 dark:bg-gray-700 flex-1 mt-2" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{username}</span>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-sm">2h</span>
                <MoreHorizontal className="w-4 h-4" />
              </div>
            </div>
            
            {caption && (
              <p className="text-sm whitespace-pre-wrap">{caption}</p>
            )}

            {mediaUrl && (
              <div className="rounded-lg overflow-hidden flex-1">
                {mediaType === 'video' ? (
                  <video src={mediaUrl} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-gray-500">
              <Heart className="w-5 h-5" />
              <MessageCircle className="w-5 h-5" />
              <Send className="w-5 h-5 -rotate-45" />
            </div>
          </div>
        </div>
        
        <div className="px-4 pb-4 text-sm text-gray-500">
          <span>12 respostas • 45 curtidas</span>
        </div>
      </div>
    )
  }

  // Fallback genérico
  return (
    <div className="w-full h-full bg-background flex flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <img src={network.iconPath} alt={network.name} className="w-5 h-5" />
        <h4 className="font-semibold">{option.name}</h4>
      </div>
      
      <div className="flex-1 bg-muted rounded-lg overflow-hidden">
        {mediaUrl ? (
          mediaType === 'video' ? (
            <video src={mediaUrl} className="w-full h-full object-cover" controls />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-900 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Nenhuma mídia</span>
          </div>
        )}
      </div>
      
      {caption && (
        <p className="mt-4 text-sm text-muted-foreground">{caption}</p>
      )}
    </div>
  )
}