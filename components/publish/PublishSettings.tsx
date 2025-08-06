'use client'

import { useState, useEffect } from 'react'
import { Settings, Lock, MessageCircle, Users, Copy, Scissors, Clock, Video, Type, Globe, Eye } from 'lucide-react'
import { findNetworkOption } from '@/lib/network-configs'
import { useAuth } from '@/lib/supabase-auth-helpers'

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
  const { user } = useAuth()
  const [selectedOption, setSelectedOption] = useState<string>(
    selectedOptions.find(opt => opt === 'tiktok_video') || selectedOptions[0] || ''
  )
  const [facebookPages, setFacebookPages] = useState<any[]>([])
  const [loadingPages, setLoadingPages] = useState(false)

  // Auto-set Facebook page from social connections (only once)
  useEffect(() => {
    const setFacebookPageFromConnection = async () => {
      if (!user) return
      
      // Check if any Facebook option is selected
      const hasFacebookOptions = selectedOptions.some(opt => opt.startsWith('facebook_'))
      if (!hasFacebookOptions) return
      
      // Check if Facebook page_id is already set for any Facebook option
      const facebookOptionsWithPageId = selectedOptions.filter(opt => 
        opt.startsWith('facebook_') && settings[opt]?.page_id
      )
      
      // If all Facebook options already have page_id set, skip
      const facebookOptions = selectedOptions.filter(opt => opt.startsWith('facebook_'))
      if (facebookOptionsWithPageId.length === facebookOptions.length) {
        console.log('[PublishSettings] Facebook page_id already set, skipping auto-load')
        return
      }
      
      console.log('[PublishSettings] Auto-loading Facebook page_id for user:', user.id)
      
      try {
        const response = await fetch('/api/social/facebook/pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          const selectedPageId = data.selected_page_id
          
          if (selectedPageId) {
            console.log('[PublishSettings] Auto-setting Facebook page_id:', selectedPageId)
            // Set the page_id for Facebook options that don't have it yet
            facebookOptions.forEach(optionId => {
              if (!settings[optionId]?.page_id) {
                updateOptionSettings(optionId, { page_id: selectedPageId })
              }
            })
          }
        }
      } catch (error) {
        console.error('[PublishSettings] Error loading Facebook connection:', error)
      }
    }
    
    setFacebookPageFromConnection()
  }, [user, selectedOptions])

  const updateOptionSettings = (optionId: string, updates: any) => {
    console.log('[PublishSettings] Updating settings for', optionId, 'with:', updates)
    const newSettings = {
      ...settings,
      [optionId]: {
        ...settings[optionId],
        ...updates
      }
    }
    console.log('[PublishSettings] New settings:', newSettings)
    onSettingsChange(newSettings)
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

          {/* YouTube Settings - Título obrigatório */}
          {(selectedOption === 'youtube_video' || selectedOption === 'youtube_shorts') && (
            <div className="space-y-6">
              {/* Título obrigatório */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={settings[selectedOption]?.title || ''}
                  onChange={(e) => updateOptionSettings(selectedOption, { title: e.target.value })}
                  placeholder="Digite o título do vídeo (obrigatório)"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Máximo 100 caracteres ({100 - (settings[selectedOption]?.title?.length || 0)} restantes)
                </p>
              </div>

              {/* Descrição automática baseada na legenda */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Descrição
                </label>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-2">
                    A descrição será preenchida automaticamente com o texto da legenda.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    • Se houver legenda específica para YouTube, ela será usada
                    <br />
                    • Caso contrário, a legenda universal será usada
                    <br />
                    • Máximo: 5000 caracteres
                  </p>
                </div>
              </div>

              {/* Privacidade */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Privacidade
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'public', label: 'Público', description: 'Qualquer pessoa pode assistir' },
                    { value: 'unlisted', label: 'Não listado', description: 'Apenas com link direto' },
                    { value: 'private', label: 'Privado', description: 'Apenas você pode assistir' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                        settings[selectedOption]?.privacy === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`youtube-privacy-${selectedOption}`}
                        value={option.value}
                        checked={settings[selectedOption]?.privacy === option.value}
                        onChange={(e) => updateOptionSettings(selectedOption, { privacy: e.target.value })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        settings[selectedOption]?.privacy === option.value
                          ? 'border-primary bg-primary'
                          : 'border-muted'
                      }`}>
                        {settings[selectedOption]?.privacy === option.value && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Tags
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={settings[selectedOption]?.tags || ''}
                  onChange={(e) => updateOptionSettings(selectedOption, { tags: e.target.value })}
                  placeholder="gaming, tutorial, tech (separadas por vírgula)"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separar por vírgula. Máximo 500 caracteres ({500 - (settings[selectedOption]?.tags?.length || 0)} restantes)
                </p>
              </div>
            </div>
          )}

          {/* Facebook Settings */}
          {(selectedOption === 'facebook_post' || selectedOption === 'facebook_story' || selectedOption === 'facebook_reels') && (
            <div className="space-y-6">
              {/* Informação da Página Selecionada */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Página do Facebook
                </label>
                
                {settings[selectedOption]?.page_id ? (
                  <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Página Configurada</h4>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Publicará na página selecionada nas suas configurações de rede.
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ID da página: {settings[selectedOption].page_id}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="w-4 h-4 text-yellow-600" />
                      <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Configuração Necessária</h4>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                      Para publicar no Facebook, você precisa primeiro conectar sua conta e selecionar uma página.
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Vá para <strong>Redes Sociais → Facebook</strong> para configurar suas páginas.
                    </p>
                  </div>
                )}
              </div>
              {/* Agendamento */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Publicação
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50">
                    <input
                      type="radio"
                      name={`facebook-schedule-${selectedOption}`}
                      value="now"
                      checked={settings[selectedOption]?.publishTime !== 'scheduled'}
                      onChange={(e) => updateOptionSettings(selectedOption, { publishTime: 'now' })}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium text-sm">Publicar agora</div>
                      <div className="text-xs text-muted-foreground">Publicação imediata</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50">
                    <input
                      type="radio"
                      name={`facebook-schedule-${selectedOption}`}
                      value="scheduled"
                      checked={settings[selectedOption]?.publishTime === 'scheduled'}
                      onChange={(e) => updateOptionSettings(selectedOption, { publishTime: 'scheduled' })}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium text-sm">Agendar publicação</div>
                      <div className="text-xs text-muted-foreground">Entre 10 min e 30 dias</div>
                    </div>
                  </label>
                </div>
                
                {settings[selectedOption]?.publishTime === 'scheduled' && (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={settings[selectedOption]?.scheduledTime || ''}
                      onChange={(e) => updateOptionSettings(selectedOption, { scheduledTime: e.target.value })}
                      min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                      max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Threads Settings */}
          {selectedOption === 'threads_post' && (
            <div className="space-y-6">
              {/* Validação de caracteres */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Limite de Caracteres</h4>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Posts no Threads são limitados a 500 caracteres de texto.
                </p>
              </div>

              {/* Tipo de mídia */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Configuração de Mídia
                </label>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    • Imagens: JPEG/PNG, máx 8MB, proporção até 10:1
                    <br />
                    • Vídeos: MOV/MP4, máx 1GB, até 5 minutos
                    <br />
                    • Carrossel: 2-20 itens de mídia
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instagram Settings */}
          {(selectedOption === 'instagram_feed' || selectedOption === 'instagram_story' || selectedOption === 'instagram_reels') && (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">Limitações da API</h4>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p>• Apenas imagens JPEG suportadas</p>
                  <p>• Máximo 10 itens em carrossel</p>
                  <p>• 100 posts por API em 24h</p>
                  <p>• Stories e Reels: mídia hospedada em servidor público</p>
                </div>
              </div>
            </div>
          )}

          {/* X (Twitter) Settings */}
          {selectedOption === 'x_post' && (
            <div className="space-y-6">
              {/* Validação de caracteres */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Limite de Caracteres</h4>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Posts no X são limitados a 280 caracteres de texto.
                </p>
              </div>

              {/* Configuração de mídia */}
              <div>
                <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Configuração de Mídia
                </label>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    • Até 4 imagens por post
                    <br />
                    • 1 vídeo por post (não pode combinar com imagens)
                    <br />
                    • Formatos: JPEG, PNG, GIF para imagens; MP4 para vídeos
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* LinkedIn Settings */}
          {(selectedOption === 'linkedin_post' || selectedOption === 'linkedin_article') && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Configurações do LinkedIn</h4>
              <p className="text-xs text-muted-foreground">
                Configurações específicas para LinkedIn serão implementadas em versão futura.
                Por enquanto, as publicações usam configurações padrão da plataforma.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}