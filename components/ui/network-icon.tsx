'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface NetworkIconProps {
  id: string
  name: string
  colors: string
  iconPath: string
  connected: boolean
  selected: boolean
  username?: string
  onClick?: () => void
  className?: string
}

export function NetworkIcon({
  id,
  name,
  colors,
  iconPath,
  connected,
  selected,
  username,
  onClick,
  className
}: NetworkIconProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = () => {
    if (connected && onClick) {
      onClick()
    }
  }

  const getIconClasses = () => {
    if (!connected) {
      // Rede não conectada - muito desabilitada
      return `grayscale opacity-30 cursor-not-allowed`
    } else if (!selected) {
      // Rede conectada mas não selecionada - escala de cinza
      return `grayscale opacity-60 hover:grayscale-0 hover:opacity-100 cursor-pointer transition-all duration-200`
    } else {
      // Rede conectada e selecionada - cores originais
      return `cursor-pointer hover:scale-105 transition-all duration-200`
    }
  }

  const getRingClasses = () => {
    if (selected && connected) {
      // Mapear cores específicas para cada rede social
      const ringColorMap: Record<string, string> = {
        'tiktok': 'ring-pink-500',
        'instagram': 'ring-purple-500', 
        'youtube': 'ring-red-500',
        'facebook': 'ring-blue-500',
        'linkedin': 'ring-blue-600',
        'threads': 'ring-gray-800'
      }
      return `ring-2 ring-offset-2 ${ringColorMap[id] || 'ring-gray-500'}`
    }
    return ''
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        onClick={handleClick}
        className={cn(
          `w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden`,
          getIconClasses(),
          getRingClasses(),
          className
        )}
      >
        <Image
          src={iconPath}
          alt={`${name} icon`}
          width={48}
          height={48}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Badge "Conectar" para redes não conectadas */}
      {!connected && (
        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          +
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg whitespace-nowrap z-50">
          <div className="font-medium">{name}</div>
          {connected ? (
            <div className="text-gray-300">
              {username ? `@${username}` : 'Conectado'}
              {selected && ' • Selecionado'}
            </div>
          ) : (
            <div className="text-gray-300">Clique para conectar</div>
          )}
          {/* Seta do tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
        </div>
      )}
    </div>
  )
}