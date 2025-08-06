"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import { ExternalLink } from "lucide-react"

const socialNetworks = [
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Conecte sua conta do TikTok para publicar vídeos',
    icon: '/images/social-icons/tiktok.png',
    href: '/networks/tiktok',
    gradient: 'from-gray-900 to-black'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Conecte sua conta Professional do Instagram',
    icon: '/images/social-icons/instagram.png',
    href: '/networks/instagram',
    gradient: 'from-purple-600 to-pink-600'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Conecte sua página do Facebook',
    icon: '/images/social-icons/facebook.png',
    href: '/networks/facebook',
    gradient: 'from-blue-600 to-blue-700',
    disabled: true
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Conecte sua conta do LinkedIn',
    icon: '/images/social-icons/linkedin.png',
    href: '/networks/linkedin',
    gradient: 'from-blue-700 to-blue-800',
    disabled: true
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Conecte seu canal do YouTube',
    icon: '/images/social-icons/youtube.png',
    href: '/networks/youtube',
    gradient: 'from-red-600 to-red-700',
    disabled: true
  },
  {
    id: 'threads',
    name: 'Threads',
    description: 'Conecte sua conta do Threads',
    icon: '/images/social-icons/threads.png',
    href: '/networks/threads',
    gradient: 'from-gray-800 to-gray-900'
  }
]

export default function NetworksPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Redes Sociais</h1>
          <p className="text-muted-foreground">
            Conecte e gerencie suas contas de redes sociais
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {socialNetworks.map((network) => (
            <Card 
              key={network.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                network.disabled ? 'opacity-50' : 'hover:scale-105'
              }`}
            >
              <CardHeader>
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${network.gradient} flex items-center justify-center mb-4`}>
                  <Image
                    src={network.icon}
                    alt={network.name}
                    width={32}
                    height={32}
                    className="brightness-0 invert"
                  />
                </div>
                <CardTitle className="flex items-center gap-2">
                  {network.name}
                  {network.disabled && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                      Em breve
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {network.description}
                </p>
                {network.disabled ? (
                  <div className="text-sm text-muted-foreground">
                    Esta integração estará disponível em breve
                  </div>
                ) : (
                  <Link
                    href={network.href}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Gerenciar {network.name}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}