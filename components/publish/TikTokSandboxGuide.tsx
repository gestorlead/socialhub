'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, X, ExternalLink, Smartphone } from 'lucide-react'

interface TikTokSandboxGuideProps {
  onClose: () => void
}

export function TikTokSandboxGuide({ onClose }: TikTokSandboxGuideProps) {
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([false, false, false])

  const toggleStep = (index: number) => {
    const newChecked = [...checkedSteps]
    newChecked[index] = !newChecked[index]
    setCheckedSteps(newChecked)
  }

  const allStepsCompleted = checkedSteps.every(step => step)

  const steps = [
    {
      title: "Configure sua conta TikTok como privada",
      description: "Abra o app TikTok → Perfil → ⚙️ Configurações → Privacidade → Conta privada: ATIVAR",
      icon: Smartphone
    },
    {
      title: "Verifique se você está logado com a conta conectada",
      description: "Certifique-se que a conta TikTok conectada aqui é a mesma que está privada no app",
      icon: CheckCircle
    },
    {
      title: "Teste a publicação",
      description: "Tente publicar um vídeo - deve aparecer apenas para você (SELF_ONLY)",
      icon: CheckCircle
    }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-semibold">Configuração Sandbox TikTok</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                Por que preciso configurar como privada?
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                Apps TikTok não auditados (sandbox) só podem publicar em contas privadas. 
                Isso é uma limitação de segurança da plataforma.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Limite:</strong> Máximo 5 usuários podem postar por app em 24h.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="font-semibold text-lg">Passo a passo:</h3>
          
          {steps.map((step, index) => {
            const IconComponent = step.icon
            const isChecked = checkedSteps[index]
            
            return (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <button
                  onClick={() => toggleStep(index)}
                  className={`w-6 h-6 border-2 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    isChecked 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                  }`}
                >
                  {isChecked && <CheckCircle className="w-4 h-4" />}
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <IconComponent className="w-4 h-4 text-gray-500" />
                    <h4 className={`font-medium ${isChecked ? 'line-through text-green-600' : ''}`}>
                      {step.title}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {allStepsCompleted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Configuração completa!
                  </span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {checkedSteps.filter(Boolean).length} de {steps.length} concluídos
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Após a auditoria TikTok:
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Quando seu app for aprovado pelo TikTok, você poderá voltar a conta para pública 
                  e publicar conteúdo público normalmente.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Fechar
            </button>
            {allStepsCompleted && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Pronto para testar!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}