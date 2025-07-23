'use client'

import { AlertTriangle, ExternalLink, Upload, Smartphone, Globe } from 'lucide-react'

interface TikTokUploadInfoProps {
  onClose?: () => void
}

export function TikTokUploadInfo({ onClose }: TikTokUploadInfoProps) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-yellow-900 dark:text-yellow-100 mb-2">
            Informações sobre Upload no TikTok
          </h3>
          
          <div className="space-y-4 text-sm text-yellow-800 dark:text-yellow-200">
            <p>
              O TikTok Content Posting API tem algumas limitações importantes:
            </p>
            
            <div className="space-y-3">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4" />
                  Método FILE_UPLOAD (Atual)
                </h4>
                <p className="text-xs">
                  • Requer upload em chunks no servidor<br/>
                  • Não pode ser feito diretamente do navegador<br/>
                  • Limitação de segurança do TikTok
                </p>
              </div>
              
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4" />
                  Método PULL_FROM_URL
                </h4>
                <p className="text-xs">
                  • Requer que o vídeo esteja em uma URL pública<br/>
                  • Precisa hospedar o arquivo primeiro (S3, Cloudinary, etc)<br/>
                  • TikTok baixa o arquivo da URL fornecida
                </p>
              </div>
            </div>
            
            <div className="border-t border-yellow-300 dark:border-yellow-700 pt-4">
              <h4 className="font-semibold mb-2">Alternativas Recomendadas:</h4>
              <div className="space-y-2">
                <a 
                  href="https://www.tiktok.com/creator-portal/content" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  TikTok Creator Portal (Web)
                </a>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>App mobile do TikTok</span>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 mt-4">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> Estamos trabalhando em uma solução para upload direto. 
                Por enquanto, recomendamos usar o Creator Portal ou o app mobile.
              </p>
            </div>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
            >
              Entendi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}