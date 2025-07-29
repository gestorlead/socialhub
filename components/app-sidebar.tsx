"use client"

import { useAuth } from "@/lib/supabase-auth-helpers"
import { dashboardItem, getMenuGroupsForRole, getRoleName } from "@/lib/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { LogOut, User2, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"

export function AppSidebar() {
  const { user, profile, userRole, signOut } = useAuth()
  const router = useRouter()
  
  const menuGroups = getMenuGroupsForRole(userRole)
  const accountName = profile?.full_name || user?.email || "Conta"
  const roleName = getRoleName(userRole)

  const handleSignOut = async () => {
    try {
      console.log('Attempting to sign out...')
      
      // Step 1: Client-side logout (clears cookies and local state)
      await signOut()
      console.log('Client-side logout completed')
      
      // Step 2: Server-side logout (ensures complete session invalidation)
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          console.log('Server-side logout completed')
        } else {
          console.warn('Server-side logout failed, but continuing...')
        }
      } catch (serverError) {
        console.warn('Server-side logout error:', serverError)
        // Continue with redirect even if server logout fails
      }
      
      console.log('Full logout process completed, redirecting to login...')
      
      // Force redirect to login with logout parameter
      window.location.href = '/login?logout=true'
    } catch (error) {
      console.error('Error during sign out:', error)
      // Even if there's an error, try to redirect to login
      window.location.href = '/login?logout=true'
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-3 py-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {accountName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {roleName}
          </p>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Dashboard */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={dashboardItem.href}>
                  <dashboardItem.icon className="h-4 w-4" />
                  <span>{dashboardItem.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Dynamic Menu Groups */}
        {menuGroups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild>
                      <Link href={item.href}>
                        {item.icon && <item.icon className="h-4 w-4" />}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex flex-col gap-2 p-2">
              <div className="flex items-center gap-2 text-sm">
                <User2 className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  asChild
                  variant="outline" 
                  size="sm"
                  className="flex-1 justify-start"
                >
                  <Link href="/profile/edit">
                    <Settings className="h-4 w-4 mr-2" />
                    Editar Perfil
                  </Link>
                </Button>
                <Button 
                  onClick={handleSignOut}
                  variant="outline" 
                  size="sm"
                  className="flex-1 justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}