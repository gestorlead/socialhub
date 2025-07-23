'use client'

import { useState } from 'react'
import { MessageSquare, Hash, AtSign, Globe, Target, Info } from 'lucide-react'

interface CaptionManagerProps {
  captions: {
    universal: string
    specific: {
      tiktok: string
    }
  }
  selectedNetworks: string[]
  onCaptionChange: (captions: CaptionManagerProps['captions']) => void
}

const NETWORK_CONFIGS = {
  tiktok: {
    name: 'TikTok',
    color: 'from-pink-500 to-rose-600',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  }
}

export function CaptionManager({ captions, selectedNetworks, onCaptionChange }: CaptionManagerProps) {
  const [activeTab, setActiveTab] = useState<'universal' | 'specific'>('universal')
  const [selectedNetwork, setSelectedNetwork] = useState<string>(selectedNetworks[0] || 'tiktok')

  const updateCaption = (type: 'universal' | 'specific', value: string, network?: string) => {
    if (type === 'universal') {
      onCaptionChange({
        ...captions,
        universal: value
      })
    } else if (network) {
      onCaptionChange({
        ...captions,
        specific: {
          ...captions.specific,
          [network]: value
        }
      })
    }
  }

  const getCharacterCount = (text: string, network: string) => {
    const config = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS]
    if (!config) return { count: text.length, limit: 2200, percentage: 0 }
    
    const count = text.length
    const limit = config.maxLength
    const percentage = Math.round((count / limit) * 100)
    
    return { count, limit, percentage }
  }

  const getEffectiveCaption = (network: string): string => {
    const specificCaption = captions.specific[network as keyof typeof captions.specific]
    return (specificCaption && specificCaption.trim() !== '') 
      ? specificCaption 
      : captions.universal
  }

  const countHashtags = (text: string) => {
    return (text.match(/#\w+/g) || []).length
  }

  const countMentions = (text: string) => {
    return (text.match(/@\w+/g) || []).length
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Legendas</h3>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('universal')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'universal'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="w-4 h-4" />
          Legenda Universal
        </button>
        <button
          onClick={() => setActiveTab('specific')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'specific'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Target className="w-4 h-4" />
          Específica por Rede
        </button>
      </div>

      {activeTab === 'universal' ? (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Legenda Universal
              </h4>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Esta legenda será usada em todas as redes selecionadas, a menos que uma legenda específica seja definida.
            </p>
          </div>

          <div>
            <textarea
              value={captions.universal}
              onChange={(e) => updateCaption('universal', e.target.value)}
              placeholder="Escreva uma legenda que funcione bem em todas as redes sociais..."
              className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            
            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {countHashtags(captions.universal)} hashtags
                </span>
                <span className="flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  {countMentions(captions.universal)} menções
                </span>
              </div>
              <span>{captions.universal.length} caracteres</span>
            </div>
          </div>

          {/* Preview for each network */}
          {selectedNetworks.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Como ficará nas redes:</h4>
              <div className="space-y-2">
                {selectedNetworks.map((network) => {
                  const config = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS]
                  const { count, limit, percentage } = getCharacterCount(captions.universal, network)
                  
                  return (
                    <div key={network} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 bg-gradient-to-br ${config.color} rounded`}></div>
                        <span className="font-medium">{config.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${percentage > 90 ? 'text-red-500' : percentage > 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {count}/{limit}
                        </span>
                        <div className={`w-12 h-2 bg-muted rounded-full overflow-hidden`}>
                          <div 
                            className={`h-full transition-all ${
                              percentage > 90 ? 'bg-red-500' : 
                              percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Network Selector */}
          {selectedNetworks.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Selecione a rede social:
              </label>
              <div className="flex gap-2">
                {selectedNetworks.map((network) => {
                  const config = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS]
                  return (
                    <button
                      key={network}
                      onClick={() => setSelectedNetwork(network)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                        selectedNetwork === network
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-3 h-3 bg-gradient-to-br ${config.color} rounded`}></div>
                      {config.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedNetworks.length > 0 && selectedNetwork && (
            <div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                    Legenda Específica para {NETWORK_CONFIGS[selectedNetwork as keyof typeof NETWORK_CONFIGS]?.name}
                  </h4>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Se definida, esta legenda terá prioridade sobre a universal para esta rede.
                  {!captions.specific[selectedNetwork as keyof typeof captions.specific] && 
                    ' Atualmente usando a legenda universal.'}
                </p>
              </div>

              <div>
                <textarea
                  value={captions.specific[selectedNetwork as keyof typeof captions.specific] || ''}
                  onChange={(e) => updateCaption('specific', e.target.value, selectedNetwork)}
                  placeholder={`Legenda específica para ${NETWORK_CONFIGS[selectedNetwork as keyof typeof NETWORK_CONFIGS]?.name}... \n\nDeixe vazio para usar a legenda universal.`}
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                
                {(() => {
                  const config = NETWORK_CONFIGS[selectedNetwork as keyof typeof NETWORK_CONFIGS]
                  const effectiveCaption = getEffectiveCaption(selectedNetwork)
                  const { count, limit, percentage } = getCharacterCount(effectiveCaption, selectedNetwork)
                  
                  return (
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <div className="flex gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {countHashtags(effectiveCaption)} hashtags
                        </span>
                        <span className="flex items-center gap-1">
                          <AtSign className="w-3 h-3" />
                          {countMentions(effectiveCaption)} menções
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${percentage > 90 ? 'text-red-500' : percentage > 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {count}/{limit}
                        </span>
                        <div className={`w-16 h-2 bg-muted rounded-full overflow-hidden`}>
                          <div 
                            className={`h-full transition-all ${
                              percentage > 90 ? 'bg-red-500' : 
                              percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Preview */}
              <div className="mt-4 p-3 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium mb-2">Preview da Legenda Final:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {getEffectiveCaption(selectedNetwork) || 'Nenhuma legenda definida'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {captions.specific[selectedNetwork as keyof typeof captions.specific] 
                    ? 'Usando legenda específica' 
                    : 'Usando legenda universal'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}