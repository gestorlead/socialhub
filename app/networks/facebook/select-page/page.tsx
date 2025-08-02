"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useSocialConnections } from "@/lib/hooks/use-social-connections"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Facebook, Users, ThumbsUp, AlertTriangle, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function FacebookSelectPagePage() {
  const { user, loading } = useAuth()
  const { getConnection, refresh } = useSocialConnections()
  const router = useRouter()
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const facebookConnection = getConnection('facebook')
  const profile = facebookConnection?.profile_data
  const pages = profile?.pages || []

  // Redirect if no Facebook connection or already has selected page
  useEffect(() => {
    if (!loading && !facebookConnection) {
      router.push('/networks/facebook')
      return
    }
    
    // If already has a selected page, redirect to Facebook page
    if (facebookConnection?.profile_data?.selected_page_id) {
      router.push('/networks/facebook')
      return
    }
  }, [loading, facebookConnection, router])

  const handlePageSelect = async () => {
    if (!selectedPageId || !facebookConnection) return

    setSaving(true)
    setError(null)

    try {
      const selectedPage = pages.find(page => page.id === selectedPageId)
      if (!selectedPage) {
        throw new Error('Página selecionada não encontrada')
      }

      // Update the connection with selected page
      const updatedProfileData = {
        ...facebookConnection.profile_data,
        selected_page_id: selectedPageId,
        selected_page: selectedPage
      }

      const response = await fetch('/api/social/facebook/select-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_id: selectedPageId,
          profile_data: updatedProfileData
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao salvar página selecionada')
      }

      // Refresh connections and redirect
      await refresh()
      router.push('/networks/facebook')

    } catch (err: any) {
      setError(err.message || 'Erro ao selecionar página')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!facebookConnection || pages.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">Nenhuma página encontrada</h2>
            <p className="text-muted-foreground mb-6">
              Você precisa ter páginas do Facebook para continuar
            </p>
            <Button onClick={() => router.push('/networks/facebook')}>
              Voltar
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#1877f2] flex items-center justify-center">
            <Facebook className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Selecione sua página</h1>
            <p className="text-muted-foreground">
              Escolha a página do Facebook que você deseja gerenciar no Social Hub
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <strong>Página única:</strong> Selecione a página que você deseja gerenciar. 
            Isso permite um foco melhor nas métricas e publicações da sua página principal.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Pages Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card 
              key={page.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedPageId === page.id 
                  ? 'ring-2 ring-[#1877f2] border-[#1877f2] bg-blue-50 dark:bg-blue-950' 
                  : 'hover:border-[#1877f2]'
              }`}
              onClick={() => setSelectedPageId(page.id)}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-700 shadow-md">
                  {page.picture ? (
                    <img 
                      src={page.picture}
                      alt={page.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1877f2]">
                      <Facebook className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">{page.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {page.category}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 bg-background rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ThumbsUp className="w-3 h-3 text-blue-600" />
                        <span className="text-xs text-muted-foreground">Curtidas</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {(page.fan_count || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="p-2 bg-background rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-muted-foreground">Seguidores</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {(page.followers_count || 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* About */}
                  {page.about && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {page.about}
                      </p>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {selectedPageId === page.id && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-[#1877f2] text-white rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Selecionada</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-6">
          <Button
            variant="outline"
            onClick={() => router.push('/networks/facebook')}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handlePageSelect}
            disabled={!selectedPageId || saving}
            className="bg-[#1877f2] hover:bg-[#166fe5]"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                Confirmar Seleção
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            A página selecionada será usada para todas as funcionalidades do Social Hub.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}