"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useState, useEffect } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { MediaUploader } from "@/components/publish/MediaUploader"
import { CaptionManager } from "@/components/publish/CaptionManager"
import { TikTokPreview } from "@/components/publish/TikTokPreview"
import { PublishSettings } from "@/components/publish/PublishSettings"
import { PublishButton } from "@/components/publish/PublishButton"
import { MultiNetworkSelector } from "@/components/ui/multi-network-selector"
import { NETWORK_CONFIGS, findNetworkOption, getCompatibleOptions } from "@/lib/network-configs"

interface PublishState {
  selectedOptions: string[] // Mudou de selectedNetworks para selectedOptions
  mediaFiles: File[]
  mediaPreviews: string[]
  captions: {
    universal: string
    specific: Record<string, string> // Mudou para suportar múltiplas opções
  }
  settings: Record<string, any> // Configurações específicas por opção selecionada
  isPublishing: boolean
}

export default function PublishPage() {
  const { user, loading } = useAuth()
  const { getConnection } = useSocialConnections()
  
  const [publishState, setPublishState] = useState<PublishState>({
    selectedOptions: [],
    mediaFiles: [],
    mediaPreviews: [],
    captions: {
      universal: '',
      specific: {}
    },
    settings: {},
    isPublishing: false
  })

  // Obter conexões das redes
  const getConnectedNetworks = () => {
    return NETWORK_CONFIGS.map(network => network.id).filter(networkId => !!getConnection(networkId))
  }

  // Função para obter usernames das redes conectadas
  const getUsernames = (networkId: string) => {
    const connection = getConnection(networkId)
    return connection?.profile_data?.username
  }

  // Função para alternar seleção de opção
  const handleOptionToggle = (optionId: string) => {
    setPublishState(prev => {
      const isSelected = prev.selectedOptions.includes(optionId)
      const newSelectedOptions = isSelected
        ? prev.selectedOptions.filter(id => id !== optionId)
        : [...prev.selectedOptions, optionId]

      return {
        ...prev,
        selectedOptions: newSelectedOptions
      }
    })
  }

  // Função para conectar rede social
  const handleConnect = (networkId: string) => {
    const network = NETWORK_CONFIGS.find(n => n.id === networkId)
    if (network) {
      window.location.href = network.connectPath
    }
  }

  // Função para determinar o tipo de mídia baseado nos arquivos selecionados
  const getMediaType = (): 'image' | 'video' | 'carousel' => {
    if (publishState.mediaFiles.length === 0) return 'image'
    if (publishState.mediaFiles.length > 1) return 'carousel'
    
    const file = publishState.mediaFiles[0]
    return file.type.startsWith('video/') ? 'video' : 'image'
  }

  // Obter opções compatíveis com o tipo de mídia atual
  const getCompatibleSelectedOptions = () => {
    const mediaType = getMediaType()
    return getCompatibleOptions(publishState.selectedOptions, mediaType)
  }

  useEffect(() => {
    // Auto-seleção pode ser implementada aqui se necessário
  }, [])

  const updatePublishState = (updates: Partial<PublishState>) => {
    setPublishState(prev => ({ ...prev, ...updates }))
  }

  const getEffectiveCaption = (optionId: string): string => {
    const specificCaption = publishState.captions.specific[optionId]
    return (specificCaption && specificCaption.trim() !== '') 
      ? specificCaption 
      : publishState.captions.universal
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Acesso necessário</h2>
          <p className="text-muted-foreground">Você precisa estar logado para publicar conteúdo.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Publicar Conteúdo</h1>
            <p className="text-muted-foreground">
              Crie e publique conteúdo nas suas redes sociais
            </p>
          </div>
        </div>

        {/* Network Selection */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Destinos de Publicação</h3>
          <MultiNetworkSelector
            networks={NETWORK_CONFIGS}
            connectedNetworks={getConnectedNetworks()}
            selectedOptions={publishState.selectedOptions}
            onOptionToggle={handleOptionToggle}
            onConnect={handleConnect}
            getUsernames={getUsernames}
          />
        </div>

        {/* Alertas de compatibilidade */}
        {publishState.selectedOptions.length > 0 && getCompatibleSelectedOptions().length < publishState.selectedOptions.length && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Atenção:</strong> Algumas opções selecionadas podem não ser compatíveis com o tipo de mídia escolhido.
              Opções compatíveis: {getCompatibleSelectedOptions().length} de {publishState.selectedOptions.length}
            </div>
          </div>
        )}

        {/* Informações sobre o tipo de mídia atual */}
        {publishState.mediaFiles.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm">
              <strong>Tipo de mídia detectado:</strong> {getMediaType()}
              {publishState.mediaFiles.length > 1 && ` (${publishState.mediaFiles.length} arquivos)`}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {publishState.selectedOptions.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Upload & Editor */}
            <div className="space-y-6">
              <MediaUploader
                onFileSelect={(files, previews) => {
                  updatePublishState({ 
                    mediaFiles: files, 
                    mediaPreviews: previews 
                  })
                }}
                selectedOptions={publishState.selectedOptions}
                maxFiles={10} // Será determinado dinamicamente baseado nas opções selecionadas
              />

              <CaptionManager
                captions={publishState.captions}
                selectedOptions={getCompatibleSelectedOptions()}
                onCaptionChange={(captions) => {
                  updatePublishState({ captions })
                }}
              />

              <PublishSettings
                selectedOptions={getCompatibleSelectedOptions()}
                settings={publishState.settings}
                onSettingsChange={(settings) => {
                  updatePublishState({ settings })
                }}
                mediaFiles={publishState.mediaFiles}
              />
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6">
              {/* Preview para cada opção selecionada */}
              {getCompatibleSelectedOptions().map((optionId) => {
                const result = findNetworkOption(optionId)
                if (!result) return null

                const { network, option } = result

                return (
                  <div key={optionId} className="bg-card border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <img 
                        src={network.iconPath} 
                        alt={network.name}
                        className="w-5 h-5"
                      />
                      <h3 className="text-lg font-semibold">{option.name}</h3>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        {option.shortName}
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      {publishState.mediaPreviews.length > 0 && (
                        <div className="grid gap-2">
                          {option.maxFiles > 1 && publishState.mediaPreviews.length > 1 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {publishState.mediaPreviews.slice(0, 4).map((preview, index) => (
                                <div key={index} className="aspect-square bg-muted rounded-lg overflow-hidden">
                                  <img 
                                    src={preview} 
                                    alt={`Media ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {publishState.mediaPreviews.length > 4 && (
                                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                                  <span className="text-sm font-medium">+{publishState.mediaPreviews.length - 4}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                              <img 
                                src={publishState.mediaPreviews[0]} 
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {getEffectiveCaption(optionId) && (
                        <div className="text-sm">
                          <div className="font-medium mb-1">Legenda:</div>
                          <div className="text-muted-foreground whitespace-pre-wrap">
                            {getEffectiveCaption(optionId)}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        <div>Suporta: {option.mediaTypes.join(', ')}</div>
                        <div>Máx. arquivos: {option.maxFiles}</div>
                      </div>
                    </div>
                  </div>
                )
              })}

              <PublishButton
                publishState={publishState}
                onPublish={() => {
                  // Handle publish logic
                }}
                getEffectiveCaption={getEffectiveCaption}
              />
            </div>
          </div>
        ) : (
          <div className="bg-card border rounded-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">📱</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Selecione onde publicar</h3>
              <p className="text-muted-foreground mb-4">
                Escolha pelo menos uma opção de publicação nas redes sociais conectadas para começar a criar seu conteúdo.
              </p>
              {getConnectedNetworks().length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Conecte suas redes sociais primeiro para ver as opções de publicação.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}