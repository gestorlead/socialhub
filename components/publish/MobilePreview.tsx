"use client"

import { Battery, Wifi, Signal } from "lucide-react"
import { NetworkPreview } from "./NetworkPreviews"

interface MobilePreviewProps {
  optionId: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'carousel'
  caption: string
  username?: string
  multipleMedia?: boolean
  mediaCount?: number
  allMediaUrls?: string[] // Array completo de URLs das mídias
}

export function MobilePreview(props: MobilePreviewProps) {
  const currentTime = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return (
    <div className="mx-auto w-full" style={{ maxWidth: '280px' }}>
      {/* Mobile Aspect Ratio Container - 9:16 */}
      <div className="aspect-[9/16] w-full bg-black rounded-lg overflow-hidden">
        <NetworkPreview 
          {...props} 
          showStatusBar={true}
          statusBarContent={{
            time: currentTime,
            signal: <Signal className="w-2.5 h-2.5 text-white" />,
            wifi: <Wifi className="w-2.5 h-2.5 text-white" />,
            battery: <Battery className="w-3 h-2 text-white fill-white" />
          }}
        />
      </div>
    </div>
  )
}