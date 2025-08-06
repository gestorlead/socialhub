'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface NetworkOption {
  id: string
  name: string
  shortName: string
  icon?: string
  description: string
  mediaTypes: ('image' | 'video' | 'carousel')[]
  maxFiles: number
  requirements?: string[]
}

export interface NetworkConfig {
  id: string
  name: string
  colors: string
  iconPath: string
  connectPath: string
  options: NetworkOption[]
}

interface MultiNetworkSelectorProps {
  networks: NetworkConfig[]
  connectedNetworks: string[]
  selectedOptions: string[]
  onOptionToggle: (optionId: string) => void
  getUsernames: (networkId: string) => string | undefined
  className?: string
}

export function MultiNetworkSelector({
  networks,
  connectedNetworks,
  selectedOptions,
  onOptionToggle,
  getUsernames,
  className
}: MultiNetworkSelectorProps) {
  const isNetworkConnected = (networkId: string) => connectedNetworks.includes(networkId)
  const isOptionSelected = (optionId: string) => selectedOptions.includes(optionId)

  const getItemClasses = (networkId: string, optionId: string) => {
    const selected = isOptionSelected(optionId)
    const baseClasses = 'inline-flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200'
    
    if (selected) {
      // Redes com gradiente usam estilos inline, outras usam classes CSS
      if (networkId === 'instagram' || networkId === 'tiktok' || networkId === 'threads') {
        return `${baseClasses} shadow-sm border-0`
      }
      
      // Map network colors to specific border colors
      const borderColorMap: Record<string, string> = {
        'youtube': 'border-red-500',
        'facebook': 'border-blue-500',
        'linkedin': 'border-blue-600',
        'x': 'border-gray-900'
      }
      
      const borderColor = borderColorMap[networkId] || 'border-primary'
      return `${baseClasses} ${borderColor} border-2 bg-gray-50 dark:bg-gray-900/20 shadow-sm`
    } 
    
    return `${baseClasses} bg-card hover:bg-muted/40`
  }

  const getNetworkSpecificStyle = (networkId: string, selected: boolean) => {
    if (!selected) return {}
    
    // Retorna estilos inline para bordas com gradiente
    const gradientBorders: Record<string, any> = {
      'instagram': {
        background: 'linear-gradient(#f9fafb, #f9fafb) padding-box, linear-gradient(45deg, #8b5cf6, #ec4899) border-box',
        border: '2px solid transparent',
        backgroundColor: '#f9fafb'
      },
      'tiktok': {
        background: 'linear-gradient(#f9fafb, #f9fafb) padding-box, linear-gradient(45deg, #ec4899, #e11d48) border-box',
        border: '2px solid transparent',
        backgroundColor: '#f9fafb'
      },
      'threads': {
        background: 'linear-gradient(#f9fafb, #f9fafb) padding-box, linear-gradient(45deg, #1f2937, #000000) border-box',
        border: '2px solid transparent',
        backgroundColor: '#f9fafb'
      }
    }
    
    return gradientBorders[networkId] || {}
  }

  const handleOptionClick = (networkId: string, optionId: string) => {
    // Como agora só mostramos redes conectadas, sempre fazemos toggle
    onOptionToggle(optionId)
  }

  const getNetworkIcon = (network: any, option: any) => {
    // Como só mostramos redes conectadas, sempre usamos o ícone ativo
    return option.icon || network.iconPath
  }

  // Filtrar apenas redes conectadas
  const allOptions = networks
    .filter(network => isNetworkConnected(network.id))
    .flatMap(network =>
      network.options.map(option => ({
        ...option,
        networkId: network.id,
        networkName: network.name,
        fullNetwork: network
      }))
    )

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {allOptions.map((option) => (
        <div
          key={option.id}
          onClick={() => handleOptionClick(option.networkId, option.id)}
          className={cn(getItemClasses(option.networkId, option.id))}
          style={getNetworkSpecificStyle(option.networkId, isOptionSelected(option.id))}
          title={option.name}
        >
          <Image
            src={getNetworkIcon(option.fullNetwork, option)}
            alt={option.networkName}
            width={20}
            height={20}
          />
        </div>
      ))}
      
      {connectedNetworks.length === 0 && (
        <div className="w-full text-sm text-muted-foreground text-center py-4">
          Nenhuma rede conectada. <br />
          <span className="text-xs">Conecte suas redes sociais primeiro para ver as opções de publicação.</span>
        </div>
      )}
    </div>
  )
}
