'use client'

import { useState } from 'react'
import { Settings, Lock, MessageCircle, Users, Copy, Scissors, Clock } from 'lucide-react'
import { findNetworkOption } from '@/lib/network-configs'

interface PublishSettingsProps {
  selectedOptions: string[]
  settings: Record<string, any>
  onSettingsChange: (settings: Record<string, any>) => void
  mediaFiles: File[]
}

const PRIVACY_OPTIONS = [
  {
    value: 'PUBLIC_TO_EVERYONE' as const,
    label: 'Público',
    description: 'Qualquer pessoa pode ver este vídeo',
    icon: Users
  },
  {
    value: 'FOLLOWER_OF_CREATOR' as const,
    label: 'Seguidores',
    description: 'Apenas seus seguidores podem ver',
    icon: Users
  },
  {
    value: 'MUTUAL_FOLLOW_FRIENDS' as const,
    label: 'Amigos',
    description: 'Pessoas que você segue e que te seguem',
    icon: Users
  },
  {
    value: 'SELF_ONLY' as const,
    label: 'Privado',
    description: 'Apenas você pode ver',
    icon: Lock
  }
]

export function PublishSettings({ 
  selectedOptions, 
  settings, 
  onSettingsChange, 
  mediaFiles 
}: PublishSettingsProps) {
  const [selectedOption, setSelectedOption] = useState<string>(
    selectedOptions.find(opt => opt === 'tiktok_video') || selectedOptions[0] || ''
  )

  const updateOptionSettings = (optionId: string, updates: any) => {
    onSettingsChange({
      ...settings,
      [optionId]: {
        ...settings[optionId],
        ...updates
      }
    })
  }

  const isVideo = mediaFiles.some(file => file.type.startsWith('video/'))
  const hasMultipleFiles = mediaFiles.length > 1

  // Obter configurações da opção atual
  const getCurrentOptionConfig = () => {
    return findNetworkOption(selectedOption)
  }

  if (selectedOptions.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Configurações</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione um destino de publicação para ver as configurações disponíveis.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Configurações</h3>
      </div>

      {/* Option Selector */}
      {selectedOptions.length > 1 && (
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">
            Configurações para:
          </label>
          <div className="flex gap-2 flex-wrap">
            {selectedOptions.map((optionId) => {
              const result = findNetworkOption(optionId)
              if (!result) return null
              
              return (
                <button
                  key={optionId}
                  onClick={() => setSelectedOption(optionId)}
                  className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                    selectedOption === optionId
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  {result.option.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Settings for Current Option */}
      {selectedOption && getCurrentOptionConfig() && (
        <div className="space-y-6">
          {/* General Settings Available for All Options */}
          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Programação de Publicação
            </label>
            <div className="p-3 border rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Agendamento será implementado em versão futura. 
                Por enquanto, as publicações são feitas imediatamente.
              </p>
            </div>
          </div>

          {/* TikTok-specific Settings */}
          {selectedOption === 'tiktok_video' && (
            <div className="space-y-6">
          {/* Privacy Settings */}
          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Privacidade do Conteúdo
            </label>
            
            <div className="space-y-2">
              {PRIVACY_OPTIONS.map((option) => {
                const IconComponent = option.icon
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                      settings.tiktok?.privacy === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`privacy-${selectedOption}`}
                      value={option.value}
                      checked={settings[selectedOption]?.privacy === option.value}
                      onChange={(e) => updateOptionSettings(selectedOption, { 
                        privacy: e.target.value as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
                      })}
                      className="sr-only"
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      settings[selectedOption]?.privacy === option.value
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Interaction Settings */}
          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Interações
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Permitir Comentários</div>
                    <div className="text-xs text-muted-foreground">
                      Usuários podem comentar no seu conteúdo
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings[selectedOption]?.allowComments || false}
                  onChange={(e) => updateOptionSettings(selectedOption, { allowComments: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
              </label>

              {isVideo && (
                <>
                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">Permitir Duet</div>
                        <div className="text-xs text-muted-foreground">
                          Outros podem criar duets com seu vídeo
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[selectedOption]?.allowDuet || false}
                      onChange={(e) => updateOptionSettings(selectedOption, { allowDuet: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        <Scissors className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">Permitir Stitch</div>
                        <div className="text-xs text-muted-foreground">
                          Outros podem usar partes do seu vídeo
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[selectedOption]?.allowStitch || false}
                      onChange={(e) => updateOptionSettings(selectedOption, { allowStitch: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                  </label>
                </>
              )}
            </div>
          </div>


          {/* Settings Summary */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Resumo das Configurações:</h4>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Privacidade: {
                  PRIVACY_OPTIONS.find(p => p.value === settings[selectedOption]?.privacy)?.label || 'Público'
                }
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3 h-3" />
                Comentários: {settings[selectedOption]?.allowComments ? 'Permitidos' : 'Desabilitados'}
              </div>
              {isVideo && (
                <>
                  <div className="flex items-center gap-2">
                    <Copy className="w-3 h-3" />
                    Duet: {settings[selectedOption]?.allowDuet ? 'Permitido' : 'Desabilitado'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Scissors className="w-3 h-3" />
                    Stitch: {settings[selectedOption]?.allowStitch ? 'Permitido' : 'Desabilitado'}
                  </div>
                </>
              )}
            </div>
          </div>
            </div>
          )}

          {/* Instagram Settings - placeholder for future */}
          {(selectedOption === 'instagram_feed' || selectedOption === 'instagram_story' || selectedOption === 'instagram_reels') && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Configurações do Instagram</h4>
              <p className="text-xs text-muted-foreground">
                Configurações específicas para Instagram serão implementadas em versão futura.
                Por enquanto, as publicações usam configurações padrão.
              </p>
            </div>
          )}

          {/* Other platforms placeholder */}
          {!selectedOption.startsWith('tiktok_') && !selectedOption.startsWith('instagram_') && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Configurações Específicas</h4>
              <p className="text-xs text-muted-foreground">
                Configurações específicas para {getCurrentOptionConfig()?.option.name} serão implementadas em versão futura.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}