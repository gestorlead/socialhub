"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useState, useEffect } from "react"
import { ArrowLeft, TikTok } from "lucide-react"
import Link from "next/link"
import { MediaUploader } from "@/components/publish/MediaUploader"
import { CaptionManager } from "@/components/publish/CaptionManager"
import { TikTokPreview } from "@/components/publish/TikTokPreview"
import { PublishSettings } from "@/components/publish/PublishSettings"
import { PublishButton } from "@/components/publish/PublishButton"

interface PublishState {
  selectedNetworks: string[]
  mediaFile: File | null
  mediaPreview: string | null
  captions: {
    universal: string
    specific: {
      tiktok: string
    }
  }
  settings: {
    tiktok?: {
      privacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
      allowComments: boolean
      allowDuet: boolean
      allowStitch: boolean
      coverTimestamp: number
    }
  }
  isPublishing: boolean
}

export default function PublishPage() {
  const { user, loading } = useAuth()
  const { getConnection } = useSocialConnections()
  
  const [publishState, setPublishState] = useState<PublishState>({
    selectedNetworks: [],
    mediaFile: null,
    mediaPreview: null,
    captions: {
      universal: '',
      specific: {
        tiktok: ''
      }
    },
    settings: {},
    isPublishing: false
  })

  const tiktokConnection = getConnection('tiktok')

  useEffect(() => {
    // Auto-select TikTok if connected
    if (tiktokConnection && !publishState.selectedNetworks.includes('tiktok')) {
      setPublishState(prev => ({
        ...prev,
        selectedNetworks: ['tiktok'],
        settings: {
          tiktok: {
            privacy: 'PUBLIC_TO_EVERYONE',
            allowComments: true,
            allowDuet: true,
            allowStitch: true,
            coverTimestamp: 0
          }
        }
      }))
    }
  }, [tiktokConnection])

  const updatePublishState = (updates: Partial<PublishState>) => {
    setPublishState(prev => ({ ...prev, ...updates }))
  }

  const getEffectiveCaption = (network: string): string => {
    const specificCaption = publishState.captions.specific[network as keyof typeof publishState.captions.specific]
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
          <h3 className="text-lg font-semibold mb-4">Redes Sociais</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                  <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                    <span className="text-xs font-bold text-black">T</span>
                  </div>
                </div>
                <div>
                  <p className="font-medium">TikTok</p>
                  <p className="text-sm text-muted-foreground">
                    {tiktokConnection 
                      ? `@${tiktokConnection.profile_data?.username || 'usuario'}`
                      : 'Não conectado'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tiktokConnection ? (
                  <>
                    <input
                      type="checkbox"
                      checked={publishState.selectedNetworks.includes('tiktok')}
                      onChange={(e) => {
                        const networks = e.target.checked
                          ? [...publishState.selectedNetworks, 'tiktok']
                          : publishState.selectedNetworks.filter(n => n !== 'tiktok')
                        updatePublishState({ selectedNetworks: networks })
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                      Conectado
                    </span>
                  </>
                ) : (
                  <Link 
                    href="/redes/tiktok"
                    className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    Conectar
                  </Link>
                )}
              </div>
            </div>

            {/* Future networks placeholder */}
            <div className="flex items-center justify-between p-3 border rounded-lg opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">IG</span>
                </div>
                <div>
                  <p className="font-medium">Instagram</p>
                  <p className="text-sm text-muted-foreground">Em breve</p>
                </div>
              </div>
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                Em desenvolvimento
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {publishState.selectedNetworks.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Upload & Editor */}
            <div className="space-y-6">
              <MediaUploader
                onFileSelect={(file, preview) => {
                  updatePublishState({ 
                    mediaFile: file, 
                    mediaPreview: preview 
                  })
                }}
                selectedNetworks={publishState.selectedNetworks}
              />

              <CaptionManager
                captions={publishState.captions}
                selectedNetworks={publishState.selectedNetworks}
                onCaptionChange={(captions) => {
                  updatePublishState({ captions })
                }}
              />

              <PublishSettings
                selectedNetworks={publishState.selectedNetworks}
                settings={publishState.settings}
                onSettingsChange={(settings) => {
                  updatePublishState({ settings })
                }}
                mediaFile={publishState.mediaFile}
              />
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6">
              {publishState.selectedNetworks.includes('tiktok') && (
                <TikTokPreview
                  mediaFile={publishState.mediaFile}
                  mediaPreview={publishState.mediaPreview}
                  caption={getEffectiveCaption('tiktok')}
                  userProfile={tiktokConnection?.profile_data}
                  settings={publishState.settings.tiktok}
                />
              )}

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
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">T</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Selecione uma rede social</h3>
              <p className="text-muted-foreground mb-4">
                Escolha pelo menos uma rede social conectada para começar a criar seu conteúdo.
              </p>
              {!tiktokConnection && (
                <Link 
                  href="/redes/tiktok"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Conectar TikTok
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}