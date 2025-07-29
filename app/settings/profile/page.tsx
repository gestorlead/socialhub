"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/supabase-auth-helpers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FullLanguageSelector } from "@/components/ui/language-selector"
import { useCommonTranslations, useAuthTranslations } from "@/hooks/useAppTranslations"
import { ArrowLeft, Save, User, Globe, Camera } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProfileData {
  full_name: string
  avatar_url: string | null
}

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile, loading } = useAuth()
  const t = useCommonTranslations()
  const tAuth = useAuthTranslations()
  const supabase = createClient()
  
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    avatar_url: null
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || "",
        avatar_url: profile.avatar_url || null
      })
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setMessage({ type: 'success', text: t('profile.saveSuccess') })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: t('profile.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setSaving(true)
    
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: data.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfileData(prev => ({ ...prev, avatar_url: data.publicUrl }))
      await refreshProfile()
      setMessage({ type: 'success', text: t('profile.avatarUpdateSuccess') })
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      setMessage({ type: 'error', text: t('profile.avatarUpdateError') })
    } finally {
      setSaving(false)
    }
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
          <h2 className="text-2xl font-bold mb-4">{tAuth('accessRequired')}</h2>
          <p className="text-muted-foreground">{tAuth('loginRequired')}</p>
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
            {t('actions.back')}
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>
            <p className="text-muted-foreground">
              {t('profile.description')}
            </p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {t('profile.personalInfo')}
              </CardTitle>
              <CardDescription>
                {t('profile.personalInfoDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={profileData.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {profileData.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Label htmlFor="avatar-upload" className="text-sm font-medium">
                      {t('profile.avatar')}
                    </Label>
                    <div className="mt-1">
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                        disabled={saving}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        {t('profile.changeAvatar')}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name">{t('profile.fullName')}</Label>
                  <Input
                    id="full_name"
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder={t('profile.fullNamePlaceholder')}
                    required
                    disabled={saving}
                  />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email">{t('profile.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('profile.emailReadonly')}
                  </p>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      {t('actions.saving')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {t('actions.saveChanges')}
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Language Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t('profile.languagePreferences')}
              </CardTitle>
              <CardDescription>
                {t('profile.languageDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('profile.preferredLanguage')}</Label>
                  <FullLanguageSelector className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {t('profile.languageHelp')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.accountInfo')}</CardTitle>
            <CardDescription>
              {t('profile.accountInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">{t('profile.memberSince')}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : t('profile.unknown')
                  }
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">{t('profile.accountType')}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile?.roles?.name || t('profile.user')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}