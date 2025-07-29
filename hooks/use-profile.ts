import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/supabase-auth-helpers'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  email?: string
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (user) {
      loadProfile()
    } else {
      setProfile(null)
      setLoading(false)
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      setProfile({
        ...data,
        email: user.email
      })
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // Reload profile after update
    await loadProfile()
  }

  const setupStorage = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/setup-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Storage setup result:', result)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to setup storage:', error)
      return false
    }
  }

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error('No user logged in')

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Math.random()}.${fileExt}`
    
    // Try to upload to avatars bucket first
    try {
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        // If bucket doesn't exist, try to create it
        if (uploadError.message.includes('Bucket not found')) {
          console.warn('Avatars bucket not found. Attempting to create it...')
          
          const setupSuccess = await setupStorage()
          if (setupSuccess) {
            // Retry upload after bucket creation
            const { error: retryError } = await supabase.storage
              .from('avatars')
              .upload(filePath, file)

            if (!retryError) {
              const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)
              return data.publicUrl
            }
          }

          // If still fails, fallback to base64
          console.warn('Storage setup failed. Using base64 fallback.')
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result as string
              resolve(base64)
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(file)
          })
        }
        throw uploadError
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Storage upload failed, falling back to base64:', error)
      
      // Fallback: convert to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
    }
  }

  return {
    profile,
    loading,
    error,
    updateProfile,
    uploadAvatar,
    reload: loadProfile
  }
}