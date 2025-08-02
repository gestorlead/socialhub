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
  onConnect: (networkId: string) => void
  getUsernames: (networkId: string) => string | undefined
  className?: string
}

export function MultiNetworkSelector({
  networks,
  connectedNetworks,
  selectedOptions,
  onOptionToggle,
  onConnect,
  getUsernames,
  className
}: MultiNetworkSelectorProps) {
  const isNetworkConnected = (networkId: string) => connectedNetworks.includes(networkId)
  const isOptionSelected = (optionId: string) => selectedOptions.includes(optionId)

  const getItemClasses = (networkId: string, optionId: string) => {
    const connected = isNetworkConnected(networkId)
    const selected = isOptionSelected(optionId)

    const baseClasses = 'inline-flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200'

    if (!connected) {
      return `${baseClasses} bg-muted/30 text-muted-foreground hover:bg-muted/50`
    } 
    
    if (selected) {
      return `${baseClasses} ring-2 ring-offset-1 ring-primary bg-primary/10`
    } 
    
    return `${baseClasses} bg-card hover:bg-muted/40`
  }

  const handleOptionClick = (networkId: string, optionId: string) => {
    if (!isNetworkConnected(networkId)) {
      onConnect(networkId)
      return
    }
    onOptionToggle(optionId)
  }

  const getNetworkIcon = (network: any, option: any) => {
    const selected = isOptionSelected(option.id)
    if (selected) {
      return option.icon || network.iconPath
    } else {
      return option.iconDisabled || network.iconDisabledPath || option.icon || network.iconPath
    }
  }

  const allOptions = networks.flatMap(network =>
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
          title={option.name}
        >
          <Image
            src={getNetworkIcon(option.fullNetwork, option)}
            alt={option.networkName}
            width={20}
            height={20}
            className={cn(!isNetworkConnected(option.networkId) ? 'grayscale' : '')}
          />
          
          {!isNetworkConnected(option.networkId) && (
             <span className="text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full">
                +
              </span>
          )}
        </div>
      ))}
      
      {connectedNetworks.length === 0 && (
        <div className="w-full text-sm text-muted-foreground text-center py-4">
          Nenhuma rede conectada. Clique em uma opção para conectar sua conta.
        </div>
      )}
    </div>
  )
}
