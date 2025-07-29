"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, User, Globe, Shield, Save, Camera, ChevronLeft } from "lucide-react"
import { createBrowserClient } from '@supabase/ssr'
import Link from "next/link"

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  preferred_language: string
  email?: string
}

const languages = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' }
]

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState("")
  const [language, setLanguage] = useState("pt")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (user && !authLoading) {
      loadProfile()
    }
  }, [user, authLoading])

  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setProfile({
          ...data,
          email: user.email
        })
        setFullName(data.full_name || "")
        setLanguage(data.preferred_language || "pt")
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar suas informações.",
        variant: "destructive"
      })
    }
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null

    const fileExt = avatarFile.name.split('.').pop()
    const fileName = `${user.id}-${Math.random()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile)

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      let avatarUrl = profile?.avatar_url

      // Upload new avatar if selected
      if (avatarFile) {
        avatarUrl = await uploadAvatar()
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          preferred_language: language,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso."
      })

      // Reload the page to apply language changes
      if (language !== profile?.preferred_language) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Erro ao atualizar perfil",
        description: "Não foi possível salvar suas alterações.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Editar Perfil</h1>
              <p className="text-muted-foreground">
                Atualize suas informações pessoais e preferências
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Informações Pessoais
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe className="h-4 w-4 mr-2" />
              Preferências
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Atualize suas informações básicas visíveis em seu perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24">
                      {(avatarPreview || profile?.avatar_url) ? (
                        <AvatarImage
                          src={avatarPreview || profile?.avatar_url || ""}
                          alt={profile?.full_name || "Avatar"}
                        />
                      ) : (
                        <AvatarFallback>
                          {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-2">
                      <Label htmlFor="avatar" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors">
                          <Camera className="h-4 w-4" />
                          <span>Alterar foto</span>
                        </div>
                      </Label>
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou GIF. Máximo 5MB.
                      </p>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preferências de Idioma</CardTitle>
                  <CardDescription>
                    Escolha o idioma preferido para a interface do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Idioma da interface</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{lang.flag}</span>
                              <span>{lang.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      A interface será exibida no idioma selecionado após salvar
                    </p>
                  </div>

                  {/* Future preferences can be added here */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Outras preferências</h4>
                    <p className="text-sm text-muted-foreground">
                      Em breve você poderá configurar notificações, tema e outras preferências.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Segurança</CardTitle>
                  <CardDescription>
                    Gerencie suas configurações de segurança e privacidade
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Autenticação de dois fatores</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Adicione uma camada extra de segurança à sua conta
                    </p>
                    <Button variant="outline" disabled>
                      Em breve
                    </Button>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Sessões ativas</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Gerencie os dispositivos conectados à sua conta
                    </p>
                    <Button variant="outline" disabled>
                      Em breve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Submit Button */}
            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}