import { UserRole } from './types/auth'
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Cog,
  UserCog,
  BarChart3,
  Edit3
} from 'lucide-react'

export interface MenuItem {
  id: string
  label: string
  href: string
  icon?: any
  requiredRole: UserRole
}

export interface MenuGroup {
  id: string
  label: string
  requiredRole: UserRole
  items: MenuItem[]
}

// Grupo Networks - Todos os usuários
export const networksGroup: MenuGroup = {
  id: 'networks',
  label: 'Networks',
  requiredRole: UserRole.USER,
  items: [
    {
      id: 'tiktok',
      label: 'TikTok',
      href: '/networks/tiktok',
      requiredRole: UserRole.USER
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: '/networks/instagram',
      requiredRole: UserRole.USER
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: '/networks/facebook',
      requiredRole: UserRole.USER
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: '/networks/linkedin',
      requiredRole: UserRole.USER
    },
    {
      id: 'youtube',
      label: 'YouTube',
      href: '/networks/youtube',
      requiredRole: UserRole.USER
    },
    {
      id: 'threads',
      label: 'Threads',
      href: '/networks/threads',
      requiredRole: UserRole.USER
    }
  ]
}

// Grupo Content - Todos os usuários
export const contentGroup: MenuGroup = {
  id: 'content',
  label: 'Content',
  requiredRole: UserRole.USER,
  items: [
    {
      id: 'publish',
      label: 'Publish',
      href: '/publish',
      icon: Edit3,
      requiredRole: UserRole.USER
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      requiredRole: UserRole.USER
    }
  ]
}

// Grupo Settings - Admins
export const settingsGroup: MenuGroup = {
  id: 'settings',
  label: 'Settings',
  requiredRole: UserRole.ADMIN,
  items: [
    {
      id: 'teams',
      label: 'Teams',
      href: '/settings/teams',
      icon: UserCog,
      requiredRole: UserRole.ADMIN
    },
    {
      id: 'users',
      label: 'Users',
      href: '/settings/users',
      icon: Users,
      requiredRole: UserRole.ADMIN
    }
  ]
}

// Grupo Integrations - Super Admin
export const integrationsGroup: MenuGroup = {
  id: 'integrations',
  label: 'Integrations',
  requiredRole: UserRole.SUPER_ADMIN,
  items: [
    {
      id: 'tiktok-integration',
      label: 'TikTok',
      href: '/integrations/tiktok',
      requiredRole: UserRole.SUPER_ADMIN
    },
    {
      id: 'meta-integration',
      label: 'Meta',
      href: '/integrations/meta',
      requiredRole: UserRole.SUPER_ADMIN
    },
    {
      id: 'google-integration',
      label: 'Google',
      href: '/integrations/google',
      requiredRole: UserRole.SUPER_ADMIN
    }
  ]
}

// Item principal Dashboard
export const dashboardItem: MenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
  requiredRole: UserRole.USER
}

export const menuGroups: MenuGroup[] = [
  networksGroup,
  contentGroup,
  settingsGroup,
  integrationsGroup
]

// Compatibility exports (deprecated - use new names)
export const redesGroup = networksGroup
export const conteudoGroup = contentGroup
export const integracoesGroup = integrationsGroup

export const getMenuGroupsForRole = (userRole: UserRole): MenuGroup[] => {
  return menuGroups.filter(group => userRole >= group.requiredRole)
}

export const getRoleName = (level: number): string => {
  switch (level) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin'
    case UserRole.ADMIN:
      return 'Admin'
    case UserRole.USER:
    default:
      return 'User'
  }
}

export const hasMenuAccess = (userRole: UserRole, menuId: string): boolean => {
  // Check dashboard access
  if (menuId === 'dashboard') {
    return userRole >= dashboardItem.requiredRole
  }
  
  // Check group access
  for (const group of menuGroups) {
    const item = group.items.find(item => item.id === menuId)
    if (item) {
      return userRole >= item.requiredRole
    }
  }
  
  return false
}