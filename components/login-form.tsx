"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/supabase-auth-helpers"
import { useAuthSession } from "@/hooks/use-auth-session"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, signInWithOAuth } = useAuth()
  const { session, loading: sessionLoading, isAuthenticated } = useAuthSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const isLogout = searchParams?.get('logout') === 'true'
  const redirectTo = searchParams?.get('redirectTo') || '/'

  useEffect(() => {
    // Wait for session to be ready and redirect authenticated users
    if (isAuthenticated && !isLogout && !sessionLoading) {
      console.log('User authenticated and ready, redirecting to:', redirectTo)
      // Add delay to ensure middleware has processed the session
      const delay = loading ? 300 : 150 // Longer delay if we just logged in
      setTimeout(() => {
        // Clear temporary cookies before redirect
        document.cookie = 'sh-login-success=; path=/; max-age=0'
        document.cookie = 'sh-login-timestamp=; path=/; max-age=0'
        router.push(redirectTo)
      }, delay)
    }
  }, [isAuthenticated, isLogout, redirectTo, router, sessionLoading, loading])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await signIn(email, password)

      if (error) throw error

      // Set explicit success cookies for middleware detection
      const hostname = window.location.hostname
      document.cookie = `sh-login-success=true; path=/; max-age=60`
      document.cookie = `sh-login-timestamp=${Date.now()}; path=/; max-age=60`
      
      console.log('Login successful, cookies set, waiting for session sync...')
      
      // Force a brief delay to ensure cookie is set before any redirects
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // The useEffect with isAuthenticated will handle the redirect
      // No need to manually redirect here
    } catch (error: any) {
      setError(error.message)
      setLoading(false)
    }
    // Note: Don't set loading to false on success - let the redirect handle it
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await signInWithOAuth('google')

      if (error) throw error
    } catch (error: any) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              {isLogout && (
                <div className="text-sm text-green-600 text-center bg-green-50 dark:bg-green-950 p-3 rounded-md">
                  Logout realizado com sucesso!
                </div>
              )}
              {error && (
                <div className="text-sm text-red-500 text-center">
                  {error}
                </div>
              )}
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : "Login"}
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  Login with Google
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="underline underline-offset-4">
                Sign up
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
