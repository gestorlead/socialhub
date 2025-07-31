'use client'

import { useState } from 'react'
import { MessageSquare, Hash, AtSign, Globe, Target, Info } from 'lucide-react'

interface CaptionManagerProps {
  captions: {
    universal: string
    specific: Record<string, string>
  }
  selectedOptions: string[]
  onCaptionChange: (captions: CaptionManagerProps['captions']) => void
}

import { findNetworkOption } from '@/lib/network-configs'

const OPTION_CONFIGS = {
  tiktok_video: {
    name: 'TikTok Video',
    color: 'from-pink-500 to-rose-600',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  instagram_feed: {
    name: 'Instagram Feed',
    color: 'from-purple-500 to-pink-500',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  instagram_story: {
    name: 'Instagram Stories',
    color: 'from-purple-500 to-pink-500',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  instagram_reels: {
    name: 'Instagram Reels',
    color: 'from-purple-500 to-pink-500',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  youtube_video: {
    name: 'YouTube Video',
    color: 'from-red-500 to-red-600',
    maxLength: 5000,
    features: {
      hashtags: true,
      mentions: false,
      emojis: true
    }
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    color: 'from-red-500 to-red-600',
    maxLength: 100,
    features: {
      hashtags: true,
      mentions: false,
      emojis: true
    }
  },
  facebook_post: {
    name: 'Facebook Post',
    color: 'from-blue-500 to-blue-600',
    maxLength: 63206,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  facebook_story: {
    name: 'Facebook Stories',
    color: 'from-blue-500 to-blue-600',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  facebook_reels: {
    name: 'Facebook Reels',
    color: 'from-blue-500 to-blue-600',
    maxLength: 2200,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  linkedin_post: {
    name: 'LinkedIn Post',
    color: 'from-blue-600 to-blue-700',
    maxLength: 3000,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  },
  linkedin_article: {
    name: 'LinkedIn Article',
    color: 'from-blue-600 to-blue-700',
    maxLength: 125000,
    features: {
      hashtags: false,
      mentions: true,
      emojis: true
    }
  },
  threads_post: {
    name: 'Threads Post',
    color: 'from-gray-800 to-black',
    maxLength: 500,
    features: {
      hashtags: true,
      mentions: true,
      emojis: true
    }
  }
}

export function CaptionManager({ captions, selectedOptions, onCaptionChange }: CaptionManagerProps) {
  const [activeTab, setActiveTab] = useState<'universal' | 'specific'>('universal')
  const [selectedOption, setSelectedOption] = useState<string>(selectedOptions[0] || '')

  const updateCaption = (type: 'universal' | 'specific', value: string, optionId?: string) => {
    if (type === 'universal') {
      onCaptionChange({
        ...captions,
        universal: value
      })
    } else if (optionId) {
      onCaptionChange({
        ...captions,
        specific: {
          ...captions.specific,
          [optionId]: value
        }
      })
    }
  }

  const getCharacterCount = (text: string, optionId: string) => {
    const config = OPTION_CONFIGS[optionId as keyof typeof OPTION_CONFIGS]
    if (!config) return { count: text.length, limit: 2200, percentage: 0 }
    
    const count = text.length
    const limit = config.maxLength
    const percentage = Math.round((count / limit) * 100)
    
    return { count, limit, percentage }
  }

  const getEffectiveCaption = (optionId: string): string => {
    const specificCaption = captions.specific[optionId]
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
          Específica por Destino
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
              Esta legenda será usada em todos os destinos selecionados, a menos que uma legenda específica seja definida.
            </p>
          </div>

          <div>
            <textarea
              value={captions.universal}
              onChange={(e) => updateCaption('universal', e.target.value)}
              placeholder="Escreva uma legenda que funcione bem em todos os destinos selecionados..."
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

          {/* Preview for each option */}
          {selectedOptions.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Como ficará em cada destino:</h4>
              <div className="space-y-2">
                {selectedOptions.map((optionId) => {
                  const config = OPTION_CONFIGS[optionId as keyof typeof OPTION_CONFIGS]
                  const { count, limit, percentage } = getCharacterCount(captions.universal, optionId)
                  
                  if (!config) return null
                  
                  return (
                    <div key={optionId} className="flex items-center justify-between p-2 border rounded text-sm">
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
          {/* Option Selector */}
          {selectedOptions.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Selecione o destino:
              </label>
              <div className="flex gap-2 flex-wrap">
                {selectedOptions.map((optionId) => {
                  const config = OPTION_CONFIGS[optionId as keyof typeof OPTION_CONFIGS]
                  if (!config) return null
                  
                  return (
                    <button
                      key={optionId}
                      onClick={() => setSelectedOption(optionId)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                        selectedOption === optionId
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

          {selectedOptions.length > 0 && selectedOption && (
            <div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                    Legenda Específica para {OPTION_CONFIGS[selectedOption as keyof typeof OPTION_CONFIGS]?.name}
                  </h4>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Se definida, esta legenda terá prioridade sobre a universal para este destino.
                  {!captions.specific[selectedOption] && 
                    ' Atualmente usando a legenda universal.'}
                </p>
              </div>

              <div>
                <textarea
                  value={captions.specific[selectedOption] || ''}
                  onChange={(e) => updateCaption('specific', e.target.value, selectedOption)}
                  placeholder={`Legenda específica para ${OPTION_CONFIGS[selectedOption as keyof typeof OPTION_CONFIGS]?.name}... \n\nDeixe vazio para usar a legenda universal.`}
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                
                {(() => {
                  const config = OPTION_CONFIGS[selectedOption as keyof typeof OPTION_CONFIGS]
                  const effectiveCaption = getEffectiveCaption(selectedOption)
                  const { count, limit, percentage } = getCharacterCount(effectiveCaption, selectedOption)
                  
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
                  {getEffectiveCaption(selectedOption) || 'Nenhuma legenda definida'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {captions.specific[selectedOption] 
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