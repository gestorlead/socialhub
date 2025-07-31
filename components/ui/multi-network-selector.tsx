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
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  const isNetworkConnected = (networkId: string) => connectedNetworks.includes(networkId)
  const isOptionSelected = (optionId: string) => selectedOptions.includes(optionId)

  const getOptionIconClasses = (networkId: string, optionId: string) => {
    const connected = isNetworkConnected(networkId)
    const selected = isOptionSelected(optionId)

    if (!connected) {
      return "grayscale opacity-30 cursor-not-allowed"
    } else if (!selected) {
      return "opacity-60 hover:opacity-100 cursor-pointer transition-all duration-200 hover:scale-105"
    } else {
      return "cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
    }
  }

  const getRingClasses = (networkId: string, optionId: string) => {
    if (isOptionSelected(optionId) && isNetworkConnected(networkId)) {
      const ringColorMap: Record<string, string> = {
        'instagram': 'ring-purple-500',
        'tiktok': 'ring-pink-500',
        'youtube': 'ring-red-500',
        'facebook': 'ring-blue-500',
        'linkedin': 'ring-blue-600',
        'threads': 'ring-gray-800'
      }
      return `ring-2 ring-offset-2 ${ringColorMap[networkId] || 'ring-gray-500'}`
    }
    return ''
  }

  const handleOptionClick = (networkId: string, optionId: string) => {
    if (!isNetworkConnected(networkId)) {
      onConnect(networkId)
      return
    }
    onOptionToggle(optionId)
  }

  const getNetworkIcon = (network: NetworkConfig, option: NetworkOption) => {
    // Se a opção tem um ícone específico, usa ele. Senão usa o ícone da rede
    if (option.icon) {
      return option.icon
    }
    return network.iconPath
  }

  return (
    <div className={cn("space-y-8", className)}>
      {networks.map((network) => (
        <div key={network.id} className="space-y-3">
          {/* Nome da rede */}
          <div className="flex items-center gap-2">
            <Image
              src={network.iconPath}
              alt={network.name}
              width={20}
              height={20}
              className="rounded"
            />
            <h4 className="font-medium text-sm">{network.name}</h4>
            {!isNetworkConnected(network.id) && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                Não conectado
              </span>
            )}
          </div>

          {/* Opções da rede */}
          <div className="flex flex-row items-center gap-6 overflow-x-auto pb-4">
            {network.options.map((option) => (
              <div
                key={option.id}
                className="relative flex-shrink-0"
                onMouseEnter={() => setShowTooltip(option.id)}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <div
                  onClick={() => handleOptionClick(network.id, option.id)}
                  className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden relative bg-muted/30 border",
                    getOptionIconClasses(network.id, option.id),
                    getRingClasses(network.id, option.id)
                  )}
                >
                  <Image
                    src={getNetworkIcon(network, option)}
                    alt={`${option.name} icon`}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                  />
                  
                  {/* Badge com nome curto da opção */}
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[24px] text-center shadow-sm">
                    {option.shortName}
                  </div>
                </div>

                {/* Badge "Conectar" para redes não conectadas */}
                {!isNetworkConnected(network.id) && (
                  <div className="absolute -top-1 -left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    +
                  </div>
                )}

                {/* Tooltip */}
                {showTooltip === option.id && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg whitespace-nowrap z-50 max-w-xs">
                    <div className="font-medium">{option.name}</div>
                    {isNetworkConnected(network.id) ? (
                      <>
                        <div className="text-gray-300 mb-1">
                          {getUsernames(network.id) ? `@${getUsernames(network.id)}` : 'Conectado'}
                          {isOptionSelected(option.id) && ' • Selecionado'}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {option.description}
                        </div>
                        <div className="text-gray-400 text-xs">
                          Suporta: {option.mediaTypes.join(', ')}
                        </div>
                        {option.maxFiles > 1 && (
                          <div className="text-gray-400 text-xs">
                            Até {option.maxFiles} arquivos
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-gray-300">Clique para conectar {network.name}</div>
                    )}
                    {/* Seta do tooltip */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Texto explicativo quando nenhuma rede estiver conectada */}
      {connectedNetworks.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          Clique nos ícones das redes sociais para conectar suas contas
        </div>
      )}
    </div>
  )
}