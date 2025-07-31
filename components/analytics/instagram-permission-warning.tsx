"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Instagram, RefreshCw } from "lucide-react"
import { useState } from "react"

interface InstagramPermissionWarningProps {
  error: string | null
  onReconnect?: () => void
}

export function InstagramPermissionWarning({ error, onReconnect }: InstagramPermissionWarningProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)

  if (!error || !error.includes('permission')) {
    return null
  }

  const handleReconnect = async () => {
    if (!onReconnect) {
      // Se não há callback personalizado, redireciona para a página de conexão
      window.location.href = '/networks/instagram'
      return
    }

    setIsReconnecting(true)
    try {
      await onReconnect()
    } catch (error) {
      console.error('Erro ao reconectar:', error)
    } finally {
      setIsReconnecting(false)
    }
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-5 h-5" />
          Permissões do Instagram Atualizadas Necessárias
        </CardTitle>
        <CardDescription className="text-yellow-700">
          Para acessar as estatísticas do Instagram, é necessário reconectar sua conta com as novas permissões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-yellow-300 bg-yellow-100">
          <Instagram className="w-4 h-4" />
          <AlertDescription className="text-yellow-800">
            <strong>Erro atual:</strong> {error}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-medium text-yellow-800">Por que isso aconteceu?</h4>
          <ul className="text-sm text-yellow-700 space-y-1 ml-4">
            <li>• Sua conta foi conectada antes da atualização das permissões</li>
            <li>• Agora precisamos da permissão "Business Insights" para mostrar estatísticas</li>
            <li>• O processo é rápido e seus dados não serão perdidos</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-yellow-800">Como resolver:</h4>
          <ol className="text-sm text-yellow-700 space-y-1 ml-4">
            <li>1. Clique no botão "Reconectar Conta" abaixo</li>
            <li>2. Faça login novamente no Instagram</li>
            <li>3. Autorize as novas permissões quando solicitado</li>
            <li>4. Volte para ver suas estatísticas funcionando</li>
          </ol>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isReconnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Reconectando...
              </>
            ) : (
              <>
                <Instagram className="w-4 h-4 mr-2" />
                Reconectar Conta
              </>
            )}
          </Button>
          
          <Button variant="outline" asChild>
            <a href="/networks/instagram" target="_blank" rel="noopener noreferrer">
              Ir para Configurações
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}