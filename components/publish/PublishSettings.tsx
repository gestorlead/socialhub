'use client'

import { useState } from 'react'
import { Settings, Lock, MessageCircle, Users, Copy, Scissors, Play } from 'lucide-react'

interface PublishSettingsProps {
  selectedNetworks: string[]
  settings: {
    tiktok?: {
      privacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
      allowComments: boolean
      allowDuet: boolean
      allowStitch: boolean
      coverTimestamp: number
    }
  }
  onSettingsChange: (settings: PublishSettingsProps['settings']) => void
  mediaFile: File | null
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
  selectedNetworks, 
  settings, 
  onSettingsChange, 
  mediaFile 
}: PublishSettingsProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<string>(
    selectedNetworks.find(n => n === 'tiktok') || selectedNetworks[0] || 'tiktok'
  )

  const updateTikTokSettings = (updates: Partial<NonNullable<typeof settings.tiktok>>) => {
    onSettingsChange({
      ...settings,
      tiktok: {
        ...settings.tiktok,
        ...updates
      } as NonNullable<typeof settings.tiktok>
    })
  }

  const isVideo = mediaFile?.type.startsWith('video/')

  if (selectedNetworks.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Configurações</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione uma rede social para ver as configurações disponíveis.
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

      {/* Network Selector */}
      {selectedNetworks.length > 1 && (
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">
            Configurações para:
          </label>
          <div className="flex gap-2">
            {selectedNetworks.map((network) => (
              <button
                key={network}
                onClick={() => setSelectedNetwork(network)}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                  selectedNetwork === network
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                }`}
              >
                {network === 'tiktok' ? 'TikTok' : network}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TikTok Settings */}
      {selectedNetwork === 'tiktok' && (
        <div className="space-y-6">
          {/* Privacy Settings */}
          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Privacidade do Conteúdo
            </label>
            
            {/* Sandbox Mode Notice */}
            {typeof window !== 'undefined' && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs">
                <p className="text-amber-700 dark:text-amber-300 font-semibold mb-2">
                  ⚠️ Modo Sandbox TikTok - Configuração Necessária:
                </p>
                <div className="text-amber-700 dark:text-amber-300 space-y-1">
                  <p>1. <strong>Conta TikTok deve estar PRIVADA:</strong></p>
                  <p className="ml-4">• Abra o TikTok → Perfil → ⚙️ Configurações</p>
                  <p className="ml-4">• Privacidade → Conta privada: <strong>ATIVAR</strong></p>
                  <p>2. Publicações serão feitas como "Apenas você" (SELF_ONLY)</p>
                </div>
              </div>
            )}
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
                      name="privacy"
                      value={option.value}
                      checked={settings.tiktok?.privacy === option.value}
                      onChange={(e) => updateTikTokSettings({ 
                        privacy: e.target.value as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
                      })}
                      className="sr-only"
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      settings.tiktok?.privacy === option.value
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
                  checked={settings.tiktok?.allowComments || false}
                  onChange={(e) => updateTikTokSettings({ allowComments: e.target.checked })}
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
                      checked={settings.tiktok?.allowDuet || false}
                      onChange={(e) => updateTikTokSettings({ allowDuet: e.target.checked })}
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
                      checked={settings.tiktok?.allowStitch || false}
                      onChange={(e) => updateTikTokSettings({ allowStitch: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Video-specific settings */}
          {isVideo && (
            <div>
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Play className="w-4 h-4" />
                Configurações do Vídeo
              </label>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">Capa do Vídeo</div>
                      <div className="text-xs text-muted-foreground">
                        Frame que aparecerá como thumbnail (em segundos)
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {settings.tiktok?.coverTimestamp || 0}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={settings.tiktok?.coverTimestamp || 0}
                    onChange={(e) => updateTikTokSettings({ coverTimestamp: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0s</span>
                    <span>30s</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Summary */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Resumo das Configurações:</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>• Privacidade: {
                PRIVACY_OPTIONS.find(p => p.value === settings.tiktok?.privacy)?.label || 'Público'
              }</div>
              <div>• Comentários: {settings.tiktok?.allowComments ? 'Permitidos' : 'Desabilitados'}</div>
              {isVideo && (
                <>
                  <div>• Duet: {settings.tiktok?.allowDuet ? 'Permitido' : 'Desabilitado'}</div>
                  <div>• Stitch: {settings.tiktok?.allowStitch ? 'Permitido' : 'Desabilitado'}</div>
                  <div>• Capa: {settings.tiktok?.coverTimestamp || 0}s</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}